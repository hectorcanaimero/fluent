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
  _BearerAwareAdapter(this.validTokens, {this.onRequest});

  final Set<String> validTokens;
  final List<String?> seen = [];

  /// Se ejecuta con la petición ya en vuelo, antes de responder: sirve para
  /// simular que **otra** petición terminó su refresco justo en ese hueco.
  final Future<void> Function(int callIndex)? onRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final auth = options.headers['Authorization'] as String?;
    final index = seen.length;
    seen.add(auth);
    await onRequest?.call(index);
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

/// Refresher que devuelve `null`: el servidor rechaza el refresh token.
class _RejectingRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

/// Almacén que revienta al leer (keystore bloqueado).
class _ThrowingOnReadStore implements TokenStore {
  int cleared = 0;

  @override
  Future<AuthTokens?> read() async => throw Exception('PlatformException(keystore)');

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async => cleared += 1;
}

/// Almacén que lee bien pero revienta al escribir.
class _ThrowingOnWriteStore implements TokenStore {
  _ThrowingOnWriteStore(this._tokens);

  AuthTokens? _tokens;
  int cleared = 0;

  @override
  Future<AuthTokens?> read() async => _tokens;

  @override
  Future<void> write(AuthTokens tokens) async =>
      throw Exception('PlatformException(keystore write)');

  @override
  Future<void> clear() async {
    cleared += 1;
    _tokens = null;
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
    final refresher = _CountingRefresher();
    late final InMemoryTokenStore store;

    // La petición sale con el token viejo del almacén (`onRequest` lo lee de
    // ahí, así que no vale poner la cabecera a mano: la sobrescribe). Solo
    // **mientras viaja** aparece el token nuevo, como si otra petición
    // hubiera terminado su refresco en ese hueco.
    final adapter = _BearerAwareAdapter(
      {'fresh-1'},
      onRequest: (index) async {
        if (index == 0) {
          await store.write(
            const AuthTokens(accessToken: 'fresh-1', refreshToken: 'r-1'),
          );
        }
      },
    );

    final built = await buildClient(adapter, refresher);
    final client = built.$1;
    final dio = built.$2;
    store = built.$3;
    addTearDown(client.dispose);

    final response = await dio.get<dynamic>('/me');

    expect(response.statusCode, 200);
    // El primer intento salió con el viejo y el reintento con el nuevo…
    expect(adapter.seen, ['Bearer stale', 'Bearer fresh-1']);
    // …sin disparar un refresco redundante, que habría invalidado el token
    // que la otra petición acababa de emitir.
    expect(refresher.calls, 0);
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

  test('una excepción del refresco NO cierra la sesión (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'nunca-valido'});
    final (client, dio, store) = await buildClient(adapter, _ThrowingRefresher());
    addTearDown(client.dispose);

    var expired = false;
    client.onSessionExpired.listen((_) => expired = true);

    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));
    await Future<void>.delayed(Duration.zero);

    // Un corte de red o un keystore bloqueado no pueden desloguear a nadie:
    // es el mismo criterio de MAL-03. La petición falla y ya.
    expect(expired, isFalse);
    expect(await store.read(), isNotNull);
  });

  test('un refresh rechazado por el servidor sí cierra la sesión (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'nunca-valido'});
    final (client, dio, store) = await buildClient(adapter, _RejectingRefresher());
    addTearDown(client.dispose);

    final expiredOnce = expectLater(client.onSessionExpired.first, completes);

    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));

    await expiredOnce;
    expect(await store.read(), isNull);
  });

  test('un almacén que revienta al leer no cierra la sesión (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'nunca-valido'});
    final dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    dio.httpClientAdapter = adapter;
    final store = _ThrowingOnReadStore();
    final client = ApiClient(
      tokenStore: store,
      tokenRefresher: _CountingRefresher(),
      dio: dio,
    );
    addTearDown(client.dispose);

    var expired = false;
    client.onSessionExpired.listen((_) => expired = true);

    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));
    await Future<void>.delayed(Duration.zero);

    expect(expired, isFalse);
    expect(store.cleared, 0);
  });

  test('si persistir el token nuevo falla, la petición se reintenta igual (MEJ-19)', () async {
    final adapter = _BearerAwareAdapter({'fresh-1'});
    final dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    dio.httpClientAdapter = adapter;
    final store = _ThrowingOnWriteStore(
      const AuthTokens(accessToken: 'stale', refreshToken: 'r0'),
    );
    final client = ApiClient(
      tokenStore: store,
      tokenRefresher: _CountingRefresher(),
      dio: dio,
    );
    addTearDown(client.dispose);

    final response = await dio.get<dynamic>('/me');

    // El refresh token viejo ya está rotado en el servidor: tirar unos tokens
    // válidos porque no se pudieron guardar dejaría la sesión irrecuperable.
    expect(response.statusCode, 200);
    expect(store.cleared, 0);
  });

  test('si el reintento vuelve a dar 401, se cierra la sesión (MAL-02)', () async {
    // El refresco da un token que el servidor tampoco acepta: sesión revocada
    // desde otro dispositivo. Sin esto la app quedaba «zombi».
    final adapter = _BearerAwareAdapter(const {});
    final (client, dio, store) = await buildClient(adapter, _CountingRefresher());
    addTearDown(client.dispose);

    final expiredOnce = expectLater(client.onSessionExpired.first, completes);

    await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));

    await expiredOnce;
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
