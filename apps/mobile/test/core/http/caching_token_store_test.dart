import 'package:fluent_mobile/core/http/caching_token_store.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';

const _tokens = AuthTokens(accessToken: 'a1', refreshToken: 'r1');
const _other = AuthTokens(accessToken: 'a2', refreshToken: 'r2');

/// Almacén que cuenta cuántas veces se le pide leer, para ver si la caché
/// realmente evita ir al keychain.
class _CountingStore implements TokenStore {
  _CountingStore([this._tokens]);

  AuthTokens? _tokens;
  int reads = 0;
  int writes = 0;
  int clears = 0;

  @override
  Future<AuthTokens?> read() async {
    reads += 1;
    return _tokens;
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    writes += 1;
    _tokens = tokens;
  }

  @override
  Future<void> clear() async {
    clears += 1;
    _tokens = null;
  }
}

void main() {
  group('CachingTokenStore (MEJ-15)', () {
    test('solo lee una vez del almacén real', () async {
      final inner = _CountingStore(_tokens);
      final store = CachingTokenStore(inner);

      expect((await store.read())?.accessToken, 'a1');
      expect((await store.read())?.accessToken, 'a1');
      expect((await store.read())?.accessToken, 'a1');

      expect(inner.reads, 1);
    });

    test('cachea también la ausencia de tokens', () async {
      final inner = _CountingStore();
      final store = CachingTokenStore(inner);

      expect(await store.read(), isNull);
      expect(await store.read(), isNull);

      // «No hay tokens» es una respuesta tan cacheable como cualquier otra:
      // si no, el caso de sesión cerrada iría al keychain en cada petición.
      expect(inner.reads, 1);
    });

    test('write actualiza la caché sin releer', () async {
      final inner = _CountingStore(_tokens);
      final store = CachingTokenStore(inner);

      await store.read();
      await store.write(_other);

      expect((await store.read())?.accessToken, 'a2');
      expect(inner.writes, 1);
      expect(inner.reads, 1);
    });

    test('clear deja la caché vacía sin releer', () async {
      final inner = _CountingStore(_tokens);
      final store = CachingTokenStore(inner);

      await store.read();
      await store.clear();

      expect(await store.read(), isNull);
      expect(inner.clears, 1);
      expect(inner.reads, 1);
    });

    test('invalidate fuerza una lectura nueva', () async {
      final inner = _CountingStore(_tokens);
      final store = CachingTokenStore(inner);

      await store.read();
      store.invalidate();
      await store.read();

      expect(inner.reads, 2);
    });

    test('propaga lo que escriba o borre el almacén real', () async {
      final inner = _CountingStore();
      final store = CachingTokenStore(inner);

      await store.write(_tokens);
      expect((await inner.read())?.accessToken, 'a1');

      await store.clear();
      expect(await inner.read(), isNull);
    });
  });
}
