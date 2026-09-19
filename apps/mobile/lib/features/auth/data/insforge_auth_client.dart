import 'package:dio/dio.dart';

import '../../../core/env.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/http/token_refresher.dart';
import '../../../core/storage/token_store.dart';

/// Cliente REST mínimo contra InsForge para auth (SPEC-06 §6). No hay SDK
/// de Dart para InsForge, así que se llama directo a sus endpoints de auth.
/// El login es solo social (Google, luego Apple) por OAuth con PKCE.
/// También implementa [TokenRefresher] para que `ApiClient` pueda refrescar
/// el token de la API de Fluent.
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

  /// Paso 1 del login social: InsForge devuelve la URL del proveedor
  /// ([provider] es `google` o `apple`). [redirectUri] es adonde vuelve el
  /// navegador con `?insforge_code=` (o `?error=`).
  Future<String> oauthAuthUrl({
    required String provider,
    required String redirectUri,
    required String codeChallenge,
  }) async {
    try {
      final res = await dio.get(
        '/api/auth/oauth/$provider',
        options: _anonAuthOptions,
        queryParameters: {
          'redirect_uri': redirectUri,
          'code_challenge': codeChallenge,
        },
      );
      return (res.data as Map<String, dynamic>)['authUrl'] as String;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Paso 2: canjea el `insforge_code` del redirect por la sesión. Con
  /// `client_type=mobile` el refresh token viene en el cuerpo.
  Future<AuthTokens> exchangeOAuthCode({
    required String code,
    required String codeVerifier,
  }) async {
    try {
      final res = await dio.post(
        '/api/auth/oauth/exchange',
        queryParameters: _clientTypeQuery,
        options: _anonAuthOptions,
        data: {'code': code, 'code_verifier': codeVerifier},
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
        message: 'oauth sign-in rejected',
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
