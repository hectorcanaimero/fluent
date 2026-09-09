import 'package:dio/dio.dart';

import '../../../core/env.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/http/token_refresher.dart';
import '../../../core/storage/token_store.dart';

/// Cliente REST mínimo contra InsForge para auth (SPEC-06 §6). No hay SDK
/// de Dart para InsForge, así que se llama directo a los cuatro endpoints
/// de auth. También implementa [TokenRefresher] para que `ApiClient` pueda
/// refrescar el token de la API de Fluent.
class InsforgeAuthClient implements TokenRefresher {
  InsforgeAuthClient({Dio? dio, String? baseUrl, String? anonKey})
    : anonKey = anonKey ?? Env.insforgeAnonKey,
      dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: baseUrl ?? Env.insforgeUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
            ),
          );

  final Dio dio;

  /// `INSFORGE_ANON_KEY` (SPEC-06 §6). Va como `Authorization: Bearer` en
  /// toda llamada de auth sin sesión todavía (alta, login, refresh).
  final String anonKey;

  static const _clientTypeQuery = {'client_type': 'mobile'};

  Options get _anonAuthOptions =>
      Options(headers: {'Authorization': 'Bearer $anonKey'});

  Future<AuthTokens> register({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      await dio.post(
        '/api/auth/users',
        queryParameters: _clientTypeQuery,
        options: _anonAuthOptions,
        data: {'email': email, 'password': password, 'name': name},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
    return login(email: email, password: password);
  }

  Future<AuthTokens> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await dio.post(
        '/api/auth/sessions',
        queryParameters: _clientTypeQuery,
        options: _anonAuthOptions,
        data: {'method': 'password', 'email': email, 'password': password},
      );
      return _tokensFromResponse(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  @override
  Future<AuthTokens?> refresh(String refreshToken) async {
    try {
      final res = await dio.post(
        '/api/auth/refresh',
        queryParameters: _clientTypeQuery,
        options: _anonAuthOptions,
        data: {'refreshToken': refreshToken},
      );
      return _tokensFromResponse(
        res.data as Map<String, dynamic>,
        fallbackRefreshToken: refreshToken,
      );
    } on DioException {
      return null;
    }
  }

  Future<void> logout(String accessToken) async {
    try {
      await dio.post(
        '/api/auth/logout',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
    } on DioException {
      // El logout local (borrar tokens) ya ocurrió; un fallo acá no debe
      // impedir que el usuario salga de la app.
    }
  }

  AuthTokens _tokensFromResponse(
    Map<String, dynamic> data, {
    String? fallbackRefreshToken,
  }) {
    return AuthTokens(
      accessToken: data['accessToken'] as String,
      refreshToken:
          (data['refreshToken'] as String?) ?? fallbackRefreshToken ?? '',
    );
  }

  ApiException _mapError(DioException e) {
    final statusCode = e.response?.statusCode;
    if (statusCode == 401 || statusCode == 400) {
      return ApiException(
        code: ApiErrorCode.unauthenticated,
        message: 'invalid email or password',
        statusCode: statusCode,
      );
    }
    return ApiException(
      code: ApiErrorCode.unknown,
      message: e.message ?? 'network error',
      statusCode: statusCode,
    );
  }
}
