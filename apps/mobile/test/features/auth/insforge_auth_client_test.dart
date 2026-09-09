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

  test('login ok devuelve los tokens', () async {
    adapter.onPost(
      '/api/auth/sessions',
      (server) => server.reply(200, {
        'accessToken': 'access-1',
        'refreshToken': 'refresh-1',
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    final tokens = await client.login(email: 'maria@example.com', password: 'secret123');

    expect(tokens.accessToken, 'access-1');
    expect(tokens.refreshToken, 'refresh-1');
  });

  test('register envía la anon key como Authorization: Bearer', () async {
    String? seenAuthHeader;
    adapter.onPost(
      '/api/auth/users',
      (server) => server.replyCallback(200, (options) {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return {};
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );
    adapter.onPost(
      '/api/auth/sessions',
      (server) => server.reply(200, {
        'accessToken': 'access-1',
        'refreshToken': 'refresh-1',
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    await client.register(
      email: 'maria@example.com',
      password: 'secret123',
      name: 'Maria',
    );

    expect(seenAuthHeader, 'Bearer anon-test-key');
  });

  test('login envía la anon key como Authorization: Bearer', () async {
    String? seenAuthHeader;
    adapter.onPost(
      '/api/auth/sessions',
      (server) => server.replyCallback(200, (options) {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return {'accessToken': 'access-1', 'refreshToken': 'refresh-1'};
      }),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    await client.login(email: 'maria@example.com', password: 'secret123');

    expect(seenAuthHeader, 'Bearer anon-test-key');
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

  test('contraseña incorrecta lanza ApiException unauthenticated', () async {
    adapter.onPost(
      '/api/auth/sessions',
      (server) => server.reply(401, {'error': 'invalid credentials'}),
      data: Matchers.any,
      queryParameters: {'client_type': 'mobile'},
    );

    expect(
      () => client.login(email: 'maria@example.com', password: 'wrong'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.unauthenticated,
        ),
      ),
    );
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
