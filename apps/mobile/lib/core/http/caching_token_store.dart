import '../storage/token_store.dart';

/// [TokenStore] que guarda los tokens en memoria además de delegarlos al
/// almacén real (MEJ-15).
///
/// `ApiClient` lee los tokens en **cada** petición para poner la cabecera
/// `Authorization`, y `SecureTokenStore` va al keychain (iOS) o al keystore
/// (Android) en cada lectura: son dos llamadas por canal de plataforma por
/// petición, que en el arranque de una pantalla con varias peticiones se
/// nota. Los tokens ya viven en memoria del proceso mientras se usan, así
/// que cachearlos no cambia la superficie de exposición.
///
/// La caché se invalida en `write` y en `clear`, que son los dos únicos
/// puntos donde los tokens cambian. Por eso este decorador tiene que
/// envolver al almacén **compartido**: si alguien escribiera saltándoselo, la
/// caché se quedaría vieja.
class CachingTokenStore implements TokenStore {
  CachingTokenStore(this._inner);

  final TokenStore _inner;

  AuthTokens? _cached;
  /// Distingue «no hay tokens» (cacheado) de «todavía no se ha leído».
  bool _loaded = false;

  @override
  Future<AuthTokens?> read() async {
    if (_loaded) return _cached;

    final tokens = await _inner.read();
    _cached = tokens;
    _loaded = true;
    return tokens;
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    await _inner.write(tokens);
    _cached = tokens;
    _loaded = true;
  }

  @override
  Future<void> clear() async {
    await _inner.clear();
    _cached = null;
    _loaded = true;
  }

  /// Olvida lo cacheado y fuerza una lectura del almacén real en la próxima
  /// llamada. Solo hace falta si algo escribe saltándose este decorador.
  void invalidate() {
    _cached = null;
    _loaded = false;
  }
}
