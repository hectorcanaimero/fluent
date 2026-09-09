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
  providerNotConnected,
  providerKeyInvalid,
  modelNotAvailable,
  sessionNotActive,
  sessionAlreadyActive,
  llmUnavailable,
  rateLimited,
  notReady,
  notFound,
  internal,
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
      case 'PROVIDER_NOT_CONNECTED':
        return ApiErrorCode.providerNotConnected;
      case 'PROVIDER_KEY_INVALID':
        return ApiErrorCode.providerKeyInvalid;
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
