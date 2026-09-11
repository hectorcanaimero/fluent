import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';

/// Adaptador que responde según el bearer que reciba: 401 para los tokens
/// vencidos y 200 para los vigentes. Anota cada Authorization que ve.
class _BearerAwareAdapter implements HttpClientAdapter {
  _BearerAwareAdapter(this.validTokens);

  final Set<String> validTokens;
  final List<String?> seen = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final auth = options.headers['Authorization'] as String?;
    seen.add(auth);
    final ok = auth != null && validTokens.contains(auth.replaceFirst('Bearer ', ''));
    return ResponseBody.fromString(
      jsonEncode({'ok': ok}),
      ok ? 200 : 401,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Cuenta los refrescos y devuelve un token nuevo cada vez.
class _CountingRefresher implements TokenRefresher {
  int calls = 0;

  @override
  Future<AuthTokens?> refresh(String refreshToken) async {
    calls += 1;
    return AuthTokens(accessToken: 'fresh-$calls', refreshToken: 'r-$calls');
  }
}

/// Refresher que revienta, en vez de devolver null.
class _ThrowingRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async {
    // Lo que lanzaría `flutter_secure_storage` si el keychain falla.
    throw Exception('PlatformException(keychain)');
  }
}

Future<(ApiClient, Dio, InMemoryTokenStore)> buildClient(
  HttpClientAdapter adapter,
  TokenRefresher refresher, {
  AuthTokens initial = const AuthTokens(accessToken: 'stale', refreshToken: 'r0'),
}) async {
  final dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
  dio.httpClientAdapter = adapter;
  final store = InMemoryTokenStore();
  await store.write(initial);
  final client = ApiClient(tokenStore: store, tokenRefresher: refresher, dio: dio);
  return (client, dio, store);
}

void main() {
  test('si otra petición ya refrescó, se reintenta sin volver a refrescar (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'fresh-1'});
    final refresher = _CountingRefresher();
    final (client, dio, store) = await buildClient(adapter, refresher);
    addTearDown(client.dispose);

    // Otra petición en vuelo ya dejó el token nuevo en el almacén.
    await store.write(const AuthTokens(accessToken: 'fresh-1', refreshToken: 'r-1'));

    // Esta salió con el viejo (cabecera explícita) y recibe 401.
    final response = await dio.get<dynamic>(
      '/me',
      options: Options(headers: {'Authorization': 'Bearer stale'}),
    );

    expect(response.statusCode, 200);
    // Lo importante: no se disparó un refresco redundante, que habría
    // invalidado el token recién emitido por la otra petición.
    expect(refresher.calls, 0);
    expect(adapter.seen.last, 'Bearer fresh-1');
  });

  test('si el token sigue siendo el vigente, sí se refresca (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'fresh-1'});
    final refresher = _CountingRefresher();
    final (client, dio, _) = await buildClient(adapter, refresher);
    addTearDown(client.dispose);

    final response = await dio.get<dynamic>('/me');

    expect(response.statusCode, 200);
    expect(refresher.calls, 1);
  });

  test('una excepción del refresco se trata como sesión expirada (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'nunca-valido'});
    final (client, dio, store) = await buildClient(adapter, _ThrowingRefresher());
    addTearDown(client.dispose);

    final expired = expectLater(client.onSessionExpired.first, completes);

    // La excepción no puede escapar como un error sin forma: tiene que
    // acabar en el camino controlado de sesión expirada.
    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));

    await expired;
    expect(await store.read(), isNull);
  });

  test('varias peticiones con el token vencido comparten un solo refresco (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'fresh-1'});
    final refresher = _CountingRefresher();
    final (client, dio, _) = await buildClient(adapter, refresher);
    addTearDown(client.dispose);

    final responses = await Future.wait([
      dio.get<dynamic>('/a'),
      dio.get<dynamic>('/b'),
      dio.get<dynamic>('/c'),
    ]);

    expect(responses.map((r) => r.statusCode), everyElement(200));
    expect(refresher.calls, 1);
  });
}
