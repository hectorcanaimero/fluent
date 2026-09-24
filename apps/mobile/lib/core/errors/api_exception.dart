/// Códigos de error de la API (SPEC-02 §6). El texto para el usuario se
/// resuelve con `AppLocalizations` a partir de [code]; nunca se muestra
/// `message` (viene en inglés/técnico) directamente en la UI.
enum ApiErrorCode {
  unauthenticated,
  forbidden,
  notOnboarded,
  validation,
  invitationInvalid,
  invitationUsed,
  invitationExpired,
  alreadyInGroup,
  planRequired,
  modelNotAvailable,
  sessionNotActive,
  sessionAlreadyActive,
  llmUnavailable,
  rateLimited,
  notReady,
  notFound,
  internal,

  /// SPEC-07 §7 (P0 MAL-19): el `challengeFromUserId` no corresponde a un
  /// desafío real ofrecido a este usuario.
  challengeNotAvailable,

  /// P1 MAL-23: tope diario de turnos alcanzado (429, con `Retry-After`
  /// hasta medianoche en la zona del usuario). La API todavía no lo manda
  /// (lo agrega Opus en esta misma ola); se mapea desde ya para no
  /// depender de otro despliegue del móvil.
  turnsDailyCap,

  /// P1 MAL-08: no llegó ningún evento del stream dentro de la ventana
  /// esperada (proxy/conexión colgada). No lo manda la API — lo genera el
  /// cliente al envolver el stream con `.timeout()` — así que no tiene caso
  /// en [fromWire].
  streamTimeout,

  /// P1 MEJ-41: `POST /groups/invitations` con 5 invitaciones sin usar ya
  /// creadas por este miembro.
  invitationLimitReached,

  /// P1 MEJ-33/MEJ-41: la cuenta todavía no tiene grupo (crear invitación,
  /// o abrir sesión sin grupo).
  groupRequired,
  unknown;

  static ApiErrorCode fromWire(String? code) {
    switch (code) {
      case 'UNAUTHENTICATED':
        return ApiErrorCode.unauthenticated;
      case 'FORBIDDEN':
        return ApiErrorCode.forbidden;
      case 'NOT_ONBOARDED':
        return ApiErrorCode.notOnboarded;
      case 'VALIDATION':
        return ApiErrorCode.validation;
      case 'INVITATION_INVALID':
        return ApiErrorCode.invitationInvalid;
      case 'INVITATION_USED':
        return ApiErrorCode.invitationUsed;
      case 'INVITATION_EXPIRED':
        return ApiErrorCode.invitationExpired;
      case 'ALREADY_IN_GROUP':
        return ApiErrorCode.alreadyInGroup;
      case 'PLAN_REQUIRED':
        return ApiErrorCode.planRequired;
      case 'MODEL_NOT_AVAILABLE':
        return ApiErrorCode.modelNotAvailable;
      case 'SESSION_NOT_ACTIVE':
        return ApiErrorCode.sessionNotActive;
      case 'SESSION_ALREADY_ACTIVE':
        return ApiErrorCode.sessionAlreadyActive;
      case 'LLM_UNAVAILABLE':
        return ApiErrorCode.llmUnavailable;
      case 'RATE_LIMITED':
        return ApiErrorCode.rateLimited;
      case 'NOT_READY':
        return ApiErrorCode.notReady;
      case 'NOT_FOUND':
        return ApiErrorCode.notFound;
      case 'INTERNAL':
        return ApiErrorCode.internal;
      case 'CHALLENGE_NOT_AVAILABLE':
        return ApiErrorCode.challengeNotAvailable;
      case 'TURNS_DAILY_CAP':
        return ApiErrorCode.turnsDailyCap;
      case 'INVITATION_LIMIT_REACHED':
        return ApiErrorCode.invitationLimitReached;
      case 'GROUP_REQUIRED':
        return ApiErrorCode.groupRequired;
      default:
        return ApiErrorCode.unknown;
    }
  }
}

/// Excepción lanzada por cualquier implementación de `FluentApi` o por el
/// cliente de auth de InsForge.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
    this.activeSessionId,
  });

  final ApiErrorCode code;
  final String message;
  final int? statusCode;
  final List<Map<String, dynamic>>? details;

  /// Presente solo en `SESSION_ALREADY_ACTIVE` (SPEC-02 §6): la API lo
  /// agrega como campo extra junto a `error`/`message`/`statusCode`, no
  /// dentro de `details`.
  final String? activeSessionId;

  @override
  String toString() => 'ApiException($code, $statusCode): $message';
}
