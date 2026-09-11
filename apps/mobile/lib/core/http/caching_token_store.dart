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
  /// Lectura en curso, compartida por quien llegue mientras tanto.
  Future<AuthTokens?>? _pending;

  /// Sube con cada `write`/`clear`/`invalidate`. Una lectura que empezó antes
  /// del cambio no puede escribir la caché al terminar: anular `_pending` no
  /// cancela su `.then`, y sin esta comprobación un `write` concurrente
  /// acabaría pisado por el valor anterior.
  int _generation = 0;

  @override
  Future<AuthTokens?> read() async {
    if (_loaded) return _cached;

    // Se cachea la **promesa**, no solo el resultado: si se esperara a que la
    // primera lectura terminase para marcar `_loaded`, una ráfaga inicial de
    // peticiones concurrentes iría al keychain N veces, que es justo el coste
    // que esto viene a quitar.
    final generation = _generation;
    return _pending ??= _inner
        .read()
        .then((tokens) {
          if (generation == _generation) {
            _cached = tokens;
            _loaded = true;
          }
          return tokens;
        })
        .whenComplete(() {
          if (generation == _generation) _pending = null;
        });
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    await _inner.write(tokens);
    _cached = tokens;
    _loaded = true;
    _invalidatePending();
  }

  @override
  Future<void> clear() async {
    await _inner.clear();
    _cached = null;
    _loaded = true;
    _invalidatePending();
  }

  /// Olvida lo cacheado y fuerza una lectura del almacén real en la próxima
  /// llamada. Solo hace falta si algo escribe saltándose este decorador.
  void invalidate() {
    _cached = null;
    _loaded = false;
    _invalidatePending();
  }

  void _invalidatePending() {
    _generation += 1;
    _pending = null;
  }
}
