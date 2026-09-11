import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

/// Refresher que siempre falla: simula el refresh token también vencido.
class _FailingRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

/// Refresher que devuelve tokens nuevos una vez.
class _WorkingRefresher implements TokenRefresher {
  int calls = 0;

  @override
  Future<AuthTokens?> refresh(String refreshToken) async {
    calls += 1;
    return const AuthTokens(accessToken: 'access-2', refreshToken: 'refresh-2');
  }
}

/// Adaptador que responde con los códigos indicados, uno por petición, y
/// anota la cabecera `Authorization` de cada una.
class _SequenceAdapter implements HttpClientAdapter {
  _SequenceAdapter(this._statuses);

  final List<int> _statuses;
  final List<String?> authorizations = [];
  int _call = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    authorizations.add(options.headers['Authorization'] as String?);
    final status = _statuses[_call.clamp(0, _statuses.length - 1)];
    _call += 1;
    return ResponseBody.fromString(
      jsonEncode({'ok': status == 200}),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late InMemoryTokenStore tokenStore;

  Future<ApiClient> buildClient(TokenRefresher refresher) async {
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    tokenStore = InMemoryTokenStore();
    await tokenStore.write(
      const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'),
    );
    return ApiClient(
      tokenStore: tokenStore,
      tokenRefresher: refresher,
      dio: dio,
    );
  }

  test('un 401 irrecuperable borra los tokens y avisa por onSessionExpired (MAL-02)', () async {
    final client = await buildClient(_FailingRefresher());
    addTearDown(client.dispose);
    adapter.onGet('/me', (server) => server.reply(401, {'error': 'UNAUTHENTICATED'}));

    final expired = expectLater(client.onSessionExpired.first, completes);

    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));

    await expired;
    expect(await tokenStore.read(), isNull);
  });

  test('si el refresh funciona no se avisa de sesión expirada', () async {
    // `DioAdapter` fija la respuesta al registrar la ruta, así que para que el
    // primer intento dé 401 y el reintento 200 hace falta un adaptador propio.
    final refresher = _WorkingRefresher();
    final sequenceAdapter = _SequenceAdapter([401, 200]);
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    dio.httpClientAdapter = sequenceAdapter;
    tokenStore = InMemoryTokenStore();
    await tokenStore.write(
      const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'),
    );
    final client = ApiClient(
      tokenStore: tokenStore,
      tokenRefresher: refresher,
      dio: dio,
    );
    addTearDown(client.dispose);

    var notified = false;
    client.onSessionExpired.listen((_) => notified = true);

    final response = await dio.get<dynamic>('/me');
    await Future<void>.delayed(Duration.zero);

    expect(response.statusCode, 200);
    expect(refresher.calls, 1);
    // El reintento fue con el token nuevo.
    expect(sequenceAdapter.authorizations.last, 'Bearer access-2');
    expect(notified, isFalse);
    expect(await tokenStore.read(), isNotNull);
  });
}
