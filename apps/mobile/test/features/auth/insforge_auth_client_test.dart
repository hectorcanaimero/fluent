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
    client = InsforgeAuthClient(dio: dio);
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
