import '../../../core/api/models.dart';

enum AuthStatus {
  /// Todavía no se resolvió si hay sesión (arranque de la app).
  unknown,
  unauthenticated,
  authenticated,
}

/// Estado global de sesión que consume el router para decidir redirecciones
/// (SPEC-06 §3): sin token → `/login`; autenticado sin `onboarded` →
/// `/onboarding`; sesión activa pendiente → `/session/:id`.
class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.onboarded = false,
    this.activeSessionId,
    this.me,
  });

  final AuthStatus status;
  final bool onboarded;
  final String? activeSessionId;
  final MeResponse? me;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    bool? onboarded,
    String? activeSessionId,
    bool clearActiveSessionId = false,
    MeResponse? me,
  }) {
    return AuthState(
      status: status ?? this.status,
      onboarded: onboarded ?? this.onboarded,
      activeSessionId:
          clearActiveSessionId ? null : (activeSessionId ?? this.activeSessionId),
      me: me ?? this.me,
    );
  }
}
