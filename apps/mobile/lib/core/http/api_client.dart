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
          // Un reintento ya trae el bearer que decidió `_retryWith`, y no
          // tiene por qué ser el del almacén: si persistir el token nuevo
          // falló, el almacén sigue teniendo el viejo y releerlo mandaría el
          // reintento con el token que acaba de dar 401.
          if (options.extra['fluent_retried'] == true &&
              options.headers['Authorization'] != null) {
            handler.next(options);
            return;
          }

          try {
            final tokens = await _tokenStore.read();
            if (tokens != null) {
              options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            }
          } catch (_) {
            // Sin cabecera: la API responderá 401 y el flujo de `onError`
            // decide. Mejor eso que tumbar la petición con la excepción del
            // keystore.
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final alreadyRetried =
              error.requestOptions.extra['fluent_retried'] == true;
          if (isUnauthorized && !alreadyRetried) {
            // Si el bearer con el que salió esta petición ya no es el
            // vigente, otra petición refrescó mientras esta viajaba: no hace
            // falta refrescar otra vez, basta con reintentar con el nuevo
            // (MEJ-19). Antes, N peticiones en vuelo con el token vencido
            // provocaban que todas esperaran un refresco —y, si el lock se
            // soltaba entre medias, alguna disparaba uno redundante que
            // invalidaba el token recién emitido.
            final AuthTokens? current;
            try {
              current = await _tokenStore.read();
            } catch (_) {
              // No se pudo leer el almacén (keystore bloqueado, por ejemplo).
              // Se deja pasar el 401 sin tocar nada: los tokens pueden ser
              // perfectamente válidos.
              handler.next(error);
              return;
            }

            final sentWith = error.requestOptions.headers['Authorization'];
            if (current != null && sentWith != 'Bearer ${current.accessToken}') {
              await _retryWith(current, error, handler);
              return;
            }

            final outcome = await _refreshOnce();

            if (outcome.tokens != null) {
              await _retryWith(outcome.tokens!, error, handler);
              return;
            }

            if (outcome.rejected) {
              await _expireSession();
            }
            // Si no fue un rechazo sino un fallo de almacén o de red, los
            // tokens se conservan: un keystore bloqueado o un corte de red no
            // pueden cerrar la sesión (mismo criterio que MAL-03).
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;
  final TokenStore _tokenStore;
  final TokenRefresher _tokenRefresher;
  Future<_RefreshOutcome>? _refreshInFlight;
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
  Future<_RefreshOutcome> _refreshOnce() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  /// Nunca lanza (MEJ-19), pero **distingue** por qué falló:
  ///
  /// - `rejected: true` solo cuando no hay tokens o el servidor rechaza el
  ///   refresh token. Eso sí es una sesión terminada y el interceptor la
  ///   cierra.
  /// - `rejected: false` cuando lo que falla es el almacén o la red. Los
  ///   tokens se conservan: un keystore bloqueado —habitual al abrir la app
  ///   desde una notificación con el móvil bloqueado— o un corte de red no
  ///   pueden desloguear a nadie. Es el mismo criterio de MAL-03, que ya
  ///   arregló esto en `AuthController`.
  ///
  /// Si el refresco sale bien pero **persistirlo** falla, se devuelven los
  /// tokens igualmente: ya son válidos y el refresh token viejo está rotado
  /// en el servidor, así que tirarlos dejaría la sesión irrecuperable.
  Future<_RefreshOutcome> _doRefresh() async {
    final AuthTokens? current;
    try {
      current = await _tokenStore.read();
    } catch (_) {
      return const _RefreshOutcome.unavailable();
    }

    if (current == null) return const _RefreshOutcome.rejected();

    final AuthTokens? refreshed;
    try {
      refreshed = await _tokenRefresher.refresh(current.refreshToken);
    } catch (_) {
      return const _RefreshOutcome.unavailable();
    }

    if (refreshed == null) return const _RefreshOutcome.rejected();

    try {
      await _tokenStore.write(refreshed);
    } catch (_) {
      // Se sigue adelante a propósito: ver el doc comment.
    }
    return _RefreshOutcome.refreshed(refreshed);
  }

  /// Reintenta la petición original con [tokens]. Si el reintento vuelve a
  /// dar 401, la sesión se cierra de verdad: el token es nuevo y aun así no
  /// vale (revocada desde otro dispositivo, por ejemplo). Sin esto la app
  /// quedaba «zombi», que es justo lo que MAL-02 vino a eliminar.
  Future<void> _retryWith(
    AuthTokens tokens,
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final options = error.requestOptions;
    options.extra['fluent_retried'] = true;
    options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';

    try {
      handler.resolve(await dio.fetch(options));
    } on DioException catch (retryError) {
      if (retryError.response?.statusCode == 401) {
        await _expireSession();
      }
      handler.next(retryError);
    }
  }

  /// Borra los tokens y avisa una sola vez (MAL-02).
  Future<void> _expireSession() async {
    try {
      await _tokenStore.clear();
    } catch (_) {
      // Si ni siquiera se puede borrar, el aviso sigue siendo lo importante:
      // el estado de la app tiene que dejar de decir «autenticado».
    }
    if (!_sessionExpired.isClosed) {
      _sessionExpired.add(null);
    }
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

/// Resultado de un intento de refresco (MEJ-19).
///
/// La diferencia entre «el servidor dijo que no» y «no se pudo preguntar» es
/// la que decide si se cierra la sesión o solo falla esta petición.
class _RefreshOutcome {
  const _RefreshOutcome.refreshed(this.tokens) : rejected = false;
  const _RefreshOutcome.rejected()
    : tokens = null,
      rejected = true;
  const _RefreshOutcome.unavailable()
    : tokens = null,
      rejected = false;

  final AuthTokens? tokens;

  /// `true` solo si la sesión está realmente terminada.
  final bool rejected;
}
