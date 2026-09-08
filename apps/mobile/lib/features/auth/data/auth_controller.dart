import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/fluent_api.dart';
import '../../../core/storage/token_store.dart';
import '../domain/auth_state.dart';

/// Controla el estado de sesión de toda la app. `InsforgeAuthClient` (T2)
/// llama a [setAuthenticated] tras un login/registro exitoso; el router
/// observa este provider para decidir redirecciones.
class AuthController extends StateNotifier<AuthState> {
  AuthController({required TokenStore tokenStore, required FluentApi api})
    : _tokenStore = tokenStore,
      _api = api,
      super(const AuthState());

  final TokenStore _tokenStore;
  final FluentApi _api;

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
    } catch (_) {
      await _tokenStore.clear();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Refresca `/me` (por ejemplo tras terminar el onboarding o una sesión).
  Future<void> refresh() async {
    if (state.status != AuthStatus.authenticated) return;
    await _loadMe();
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
