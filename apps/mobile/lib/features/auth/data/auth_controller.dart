import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/fluent_api.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/token_store.dart';
import '../domain/auth_state.dart';
import 'insforge_auth_client.dart';

/// Controla el estado de sesión de toda la app. `InsforgeAuthClient` (T2)
/// llama a [setAuthenticated] tras un login/registro exitoso; el router
/// observa este provider para decidir redirecciones.
class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required TokenStore tokenStore,
    required FluentApi api,
    InsforgeAuthClient? authClient,
    Stream<void>? sessionExpired,
    Future<void> Function()? beforeLogout,
  }) : _tokenStore = tokenStore,
       _api = api,
       _authClient = authClient,
       _beforeLogout = beforeLogout,
       super(const AuthState()) {
    _sessionExpiredSub = sessionExpired?.listen((_) => _onSessionExpired());
  }

  final TokenStore _tokenStore;
  final FluentApi _api;

  /// Cliente de auth de InsForge para revocar la sesión (se le manda el
  /// access token) al cerrar sesión. Opcional: los tests que no ejercitan el logout remoto no lo
  /// necesitan, y sin él `logout()` sigue limpiando el estado local.
  final InsforgeAuthClient? _authClient;

  /// Se corre al cerrar sesión con los tokens todavía guardados (por
  /// ejemplo, dar de baja el token de push). Nunca bloquea el logout.
  final Future<void> Function()? _beforeLogout;
  StreamSubscription<void>? _sessionExpiredSub;

  @override
  void dispose() {
    unawaited(_sessionExpiredSub?.cancel());
    super.dispose();
  }

  /// `ApiClient` no pudo recuperar un 401 y borró los tokens (MAL-02): el
  /// estado tiene que seguirle, si no la app queda "autenticada" sin token y
  /// todas las pantallas fallan con un error genérico hasta reiniciarla.
  void _onSessionExpired() {
    if (!mounted) return;
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Se ejecuta una vez al arrancar la app, antes de construir el router.
  Future<void> bootstrap() async {
    final tokens = await _tokenStore.read();
    if (tokens == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    await _loadMe(isBootstrap: true);
  }

  /// Llamado por el flujo de login/registro tras guardar los tokens.
  Future<void> setAuthenticated(AuthTokens tokens) async {
    await _tokenStore.write(tokens);
    await _loadMe(isBootstrap: false);
  }

  /// [isBootstrap] distingue el arranque de un refresco en caliente. Solo el
  /// arranque puede dejar el estado en [AuthStatus.error]: `refresh()` se
  /// llama desde pantallas en las que el usuario ya está trabajando (tras
  /// conectar un proveedor, al terminar el onboarding) y un `/me` que falla
  /// un momento no puede sacarlo de ahí a un splash a pantalla completa.
  Future<void> _loadMe({required bool isBootstrap}) async {
    try {
      final me = await _api.getMe();
      state = state.copyWith(
        status: AuthStatus.authenticated,
        onboarded: me.onboarded,
        activeSessionId: me.activeSessionId,
        clearActiveSessionId: me.activeSessionId == null,
        me: me,
      );
    } on ApiException catch (e) {
      // Solo un 401 significa que los tokens ya no valen. Antes se borraban
      // ante *cualquier* error, así que abrir la app en modo avión, con un
      // timeout o contra un 500 obligaba a volver a loguearse (MAL-03).
      if (e.code == ApiErrorCode.unauthenticated || e.statusCode == 401) {
        await _tokenStore.clear();
        state = const AuthState(status: AuthStatus.unauthenticated);
      } else if (isBootstrap) {
        state = state.copyWith(status: AuthStatus.error);
      }
    } catch (_) {
      if (isBootstrap) {
        state = state.copyWith(status: AuthStatus.error);
      }
    }
  }

  /// Refresca `/me` (por ejemplo tras terminar el onboarding o una sesión).
  Future<void> refresh() async {
    if (state.status != AuthStatus.authenticated) return;
    await _loadMe(isBootstrap: false);
  }

  /// Reintento del splash tras un [AuthStatus.error] (MAL-03): vuelve a
  /// empezar el arranque con los tokens que se conservaron.
  Future<void> retry() => bootstrap();

  /// Olvida la sesión activa [id] si es la que está en el estado (MAL-04).
  ///
  /// El router empuja a `/session/:id` mientras `activeSessionId` no sea
  /// null; sin esto, al llegar al resumen de una sesión ya cerrada volvía a
  /// empujar a la conversación y no se podía salir sin reiniciar. Se compara
  /// el id para no borrar por error una sesión distinta abierta entretanto.
  void clearActiveSession(String id) {
    if (state.activeSessionId != id) return;
    state = state.copyWith(clearActiveSessionId: true);
  }

  Future<void> logout() async {
    // El token se lee **antes** de borrarlo: después ya no se sabría cuál era
    // (MAL-02). La revocación en InsForge se lanza sin esperarla: su Dio tiene
    // 15 s de connect timeout, y sin red el usuario se quedaría mirando una
    // pantalla muerta antes de que pasara nada en local. `logout` ya traga
    // los fallos de red por dentro.
    final tokens = await _tokenStore.read();
    final beforeLogout = _beforeLogout;
    if (beforeLogout != null) {
      try {
        await beforeLogout().timeout(const Duration(seconds: 3));
      } catch (_) {}
    }
    final pending = (tokens != null && _authClient != null)
        ? _authClient.logout(tokens.accessToken)
        : null;
    if (pending != null) {
      unawaited(pending);
    }

    await _tokenStore.clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
