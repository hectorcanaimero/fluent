import 'dart:async';

import 'package:dio/dio.dart';

import '../env.dart';
import '../errors/api_exception.dart';
import '../storage/token_store.dart';
import 'token_refresher.dart';

/// Cliente HTTP compartido para la API de Fluent (NestJS). Adjunta el
/// bearer, traduce errores `{error,message,statusCode}` a [ApiException] y
/// refresca el token una vez con lock ante un 401 (SPEC-06 §6).
class ApiClient {
  ApiClient({
    required TokenStore tokenStore,
    required TokenRefresher tokenRefresher,
    Dio? dio,
    String? baseUrl,
  }) : _tokenStore = tokenStore,
       _tokenRefresher = tokenRefresher,
       dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: baseUrl ?? Env.apiUrl,
               connectTimeout: const Duration(seconds: 15),
               receiveTimeout: const Duration(seconds: 20),
             ),
           ) {
    this.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final tokens = await _tokenStore.read();
          if (tokens != null) {
            options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final alreadyRetried =
              error.requestOptions.extra['fluent_retried'] == true;
          if (isUnauthorized && !alreadyRetried) {
            final refreshed = await _refreshOnce();
            if (refreshed != null) {
              final options = error.requestOptions;
              options.extra['fluent_retried'] = true;
              options.headers['Authorization'] =
                  'Bearer ${refreshed.accessToken}';
              try {
                final response = await this.dio.fetch(options);
                handler.resolve(response);
                return;
              } on DioException catch (retryError) {
                handler.next(retryError);
                return;
              }
            }
            await _tokenStore.clear();
            // Los tokens ya no sirven, pero nadie más se entera: sin este
            // aviso `AuthController` seguía en `authenticated` y la app
            // quedaba "zombi", dando errores genéricos en cada pantalla
            // hasta reiniciarla (MAL-02).
            if (!_sessionExpired.isClosed) {
              _sessionExpired.add(null);
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;
  final TokenStore _tokenStore;
  final TokenRefresher _tokenRefresher;
  Future<AuthTokens?>? _refreshInFlight;
  final StreamController<void> _sessionExpired =
      StreamController<void>.broadcast();

  /// Emite cuando un 401 no se pudo recuperar refrescando y los tokens se
  /// borraron. `AuthController` se suscribe para pasar a
  /// `AuthStatus.unauthenticated` y que el router mande a `/login`.
  ///
  /// Es un stream de difusión y no un callback único porque el cliente vive
  /// más que cualquier pantalla: varios oyentes pueden entrar y salir sin
  /// pisarse.
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  /// Cierra el stream de [onSessionExpired]. La app usa un único cliente
  /// durante toda su vida; esto es para los tests y para `ref.onDispose`.
  void dispose() {
    unawaited(_sessionExpired.close());
  }

  /// Evita refrescos concurrentes: si ya hay uno en curso, todas las
  /// peticiones que reciben 401 al mismo tiempo esperan el mismo resultado.
  Future<AuthTokens?> _refreshOnce() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<AuthTokens?> _doRefresh() async {
    final current = await _tokenStore.read();
    if (current == null) return null;
    final refreshed = await _tokenRefresher.refresh(current.refreshToken);
    if (refreshed == null) return null;
    await _tokenStore.write(refreshed);
    return refreshed;
  }

  /// Ejecuta [body] y traduce cualquier [DioException] con cuerpo
  /// `{error,message,statusCode}` a [ApiException].
  Future<T> guard<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  static ApiException mapDioException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      return ApiException(
        code: ApiErrorCode.fromWire(data['error'] as String?),
        message: (data['message'] as String?) ?? e.message ?? 'error',
        statusCode: e.response?.statusCode,
        details: (data['details'] as List?)?.cast<Map<String, dynamic>>(),
        activeSessionId: data['activeSessionId'] as String?,
      );
    }
    return ApiException(
      code: ApiErrorCode.unknown,
      message: e.message ?? 'network error',
      statusCode: e.response?.statusCode,
    );
  }
}
