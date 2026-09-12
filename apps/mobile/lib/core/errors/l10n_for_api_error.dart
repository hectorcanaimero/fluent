import '../../l10n/gen/app_localizations.dart';
import 'api_exception.dart';

/// MEJ-10: texto para el usuario por [ApiErrorCode], en vez de que cada
/// pantalla muestre el mismo `errorGeneric` sin importar qué falló.
/// `unknown` (o cualquier código nuevo que la app todavía no conozca) cae
/// en [AppLocalizations.errorGeneric].
String l10nForApiError(ApiErrorCode code, AppLocalizations l10n) {
  return switch (code) {
    ApiErrorCode.unauthenticated => l10n.errorUnauthenticated,
    ApiErrorCode.forbidden => l10n.errorForbidden,
    ApiErrorCode.notOnboarded => l10n.errorNotOnboarded,
    ApiErrorCode.validation => l10n.errorValidation,
    ApiErrorCode.invitationInvalid => l10n.errorInvitationInvalid,
    ApiErrorCode.invitationUsed => l10n.errorInvitationUsed,
    ApiErrorCode.invitationExpired => l10n.errorInvitationExpired,
    ApiErrorCode.alreadyInGroup => l10n.errorAlreadyInGroup,
    ApiErrorCode.providerNotConnected => l10n.errorProviderNotConnected,
    ApiErrorCode.providerKeyInvalid => l10n.errorProviderKeyInvalid,
    ApiErrorCode.modelNotAvailable => l10n.errorModelNotAvailable,
    ApiErrorCode.sessionNotActive => l10n.errorSessionNotActive,
    ApiErrorCode.sessionAlreadyActive => l10n.errorSessionAlreadyActive,
    ApiErrorCode.llmUnavailable => l10n.errorLlmUnavailable,
    ApiErrorCode.rateLimited => l10n.errorRateLimited,
    ApiErrorCode.notReady => l10n.errorNotReady,
    ApiErrorCode.notFound => l10n.errorNotFound,
    ApiErrorCode.internal => l10n.errorInternal,
    ApiErrorCode.challengeNotAvailable => l10n.errorChallengeNotAvailable,
    ApiErrorCode.turnsDailyCap => l10n.errorTurnsDailyCap,
    // MAL-08: en el flujo normal no debería llegar hasta acá —
    // `_sendTurnWithStreamFallback` lo trata como un corte de transporte y
    // cae al modo completo en vez de mostrarlo — pero si de todos modos
    // escapa (por ejemplo, el propio endpoint de caída vuelve a colgarse),
    // tiene su propio texto en vez de cae en el genérico.
    ApiErrorCode.streamTimeout => l10n.errorStreamTimeout,
    ApiErrorCode.invitationLimitReached => l10n.errorInvitationLimitReached,
    ApiErrorCode.groupRequired => l10n.errorGroupRequired,
    ApiErrorCode.unknown => l10n.errorGeneric,
  };
}
