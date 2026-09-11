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
  }) : _tokenStore = tokenStore,
       _api = api,
       _authClient = authClient,
       super(const AuthState()) {
    _sessionExpiredSub = sessionExpired?.listen((_) => _onSessionExpired());
  }

  final TokenStore _tokenStore;
  final FluentApi _api;

  /// Cliente de auth de InsForge para revocar el refresh token al cerrar
  /// sesión. Opcional: los tests que no ejercitan el logout remoto no lo
  /// necesitan, y sin él `logout()` sigue limpiando el estado local.
  final InsforgeAuthClient? _authClient;
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
    await _loadMe();
  }

  /// Llamado por el flujo de login/registro tras guardar los tokens.
  Future<void> setAuthenticated(AuthTokens tokens) async {
    await _tokenStore.write(tokens);
    await _loadMe();
  }

  Future<void> _loadMe() async {
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
      } else {
        state = state.copyWith(status: AuthStatus.error);
      }
    } catch (_) {
      state = state.copyWith(status: AuthStatus.error);
    }
  }

  /// Refresca `/me` (por ejemplo tras terminar el onboarding o una sesión).
  Future<void> refresh() async {
    if (state.status != AuthStatus.authenticated) return;
    await _loadMe();
  }

  /// Reintento del splash tras un [AuthStatus.error] (MAL-03): vuelve a
  /// empezar el arranque con los tokens que se conservaron.
  Future<void> retry() => bootstrap();

  Future<void> logout() async {
    // Revocar el refresh token en InsForge **antes** de borrarlo: después ya
    // no se sabría cuál era (MAL-02). Un fallo de red aquí no puede impedir
    // el cierre local, y `InsforgeAuthClient.logout` ya los traga.
    final tokens = await _tokenStore.read();
    if (tokens != null && _authClient != null) {
      await _authClient.logout(tokens.accessToken);
    }

    await _tokenStore.clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
