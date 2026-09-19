import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late InsforgeAuthClient client;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://insforge.local'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    client = InsforgeAuthClient(dio: dio, anonKey: 'anon-test-key');
  });

  test('oauthAuthUrl manda redirect_uri y code_challenge con la anon key', () async {
    String? seenAuthHeader;
    adapter.onGet(
      '/api/auth/oauth/google',
      (server) => server.replyCallback(200, (options) {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return {'authUrl': 'https://accounts.google.com/o/oauth2/v2/auth?x=1'};
      }),
      queryParameters: {
        'redirect_uri': 'fluent://oauth/insforge',
        'code_challenge': 'challenge-1',
      },
    );

    final url = await client.oauthAuthUrl(
      provider: 'google',
      redirectUri: 'fluent://oauth/insforge',
      codeChallenge: 'challenge-1',
    );

    expect(url, startsWith('https://accounts.google.com/'));
    expect(seenAuthHeader, 'Bearer anon-test-key');
  });

  test('exchangeOAuthCode devuelve los tokens de client_type=mobile', () async {
    Object? seenBody;
    adapter.onPost(
      '/api/auth/oauth/exchange',
      (server) => server.replyCallback(200, (options) {
        seenBody = options.data;
        return {'accessToken': 'access-1', 'refreshToken': 'refresh-1'};
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    final tokens = await client.exchangeOAuthCode(
      code: 'insforge-code',
      codeVerifier: 'verifier-1',
    );

    expect(tokens.accessToken, 'access-1');
    expect(tokens.refreshToken, 'refresh-1');
    expect(seenBody, {'code': 'insforge-code', 'code_verifier': 'verifier-1'});
  });

  test('un código de canje inválido lanza ApiException unauthenticated', () async {
    adapter.onPost(
      '/api/auth/oauth/exchange',
      (server) => server.reply(400, {'error': 'INVALID_CODE'}),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    expect(
      () => client.exchangeOAuthCode(code: 'bad', codeVerifier: 'v'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.unauthenticated,
        ),
      ),
    );
  });

  test('refresh envía la anon key como Authorization: Bearer', () async {
    String? seenAuthHeader;
    adapter.onPost(
      '/api/auth/refresh',
      (server) => server.replyCallback(200, (options) {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return {'accessToken': 'access-2', 'refreshToken': 'refresh-2'};
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    await client.refresh('refresh-1');

    expect(seenAuthHeader, 'Bearer anon-test-key');
  });

  test('logout envía el bearer del usuario, no la anon key', () async {
    String? seenAuthHeader;
    adapter.onPost(
      '/api/auth/logout',
      (server) => server.replyCallback(200, (options) {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return {};
      }),
    );

    await client.logout('user-access-token');

    expect(seenAuthHeader, 'Bearer user-access-token');
  });

  test('refresh sin sesión válida devuelve null', () async {
    adapter.onPost(
      '/api/auth/refresh',
      (server) => server.reply(401, {'error': 'invalid refresh token'}),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    final result = await client.refresh('expired-refresh-token');

    expect(result, isNull);
  });
}
