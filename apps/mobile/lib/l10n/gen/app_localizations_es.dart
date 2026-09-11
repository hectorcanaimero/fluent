// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'Fluent';

  @override
  String get splashLoading => 'Cargando…';

  @override
  String get tabHome => 'Home';

  @override
  String get tabPractice => 'Practicar';

  @override
  String get tabGroup => 'Grupo';

  @override
  String get tabProgress => 'Progreso';

  @override
  String get comingSoonTitle => 'Muy pronto';

  @override
  String get commonLoadErrorTitle => 'No pudimos cargar esto';

  @override
  String get commonLoadErrorBody => 'Revisá tu conexión e intentá de nuevo.';

  @override
  String get commonRetry => 'Reintentar';

  @override
  String get formFieldRequired => 'Este campo es obligatorio.';

  @override
  String get loginWelcomeHeadline =>
      'Hablá inglés con confianza, de a 10 minutos';

  @override
  String get loginWelcomeSubtitle =>
      'Fluent es tu coach de conversación personal. Dos sesiones cortas por día, sobre temas que realmente te interesan.';

  @override
  String get loginBenefit1 => 'Conversaciones reales con un tutor de IA';

  @override
  String get loginBenefit2 => 'Hablá de las noticias de hoy, a tu manera';

  @override
  String get loginBenefit3 => 'Construí una racha que se sostiene';

  @override
  String get loginGetStartedButton => 'Crear cuenta';

  @override
  String get loginAlreadyHaveAccount => '¿Ya tenés una cuenta? Iniciá sesión';

  @override
  String get loginEmailLabel => 'Email';

  @override
  String get loginPasswordLabel => 'Contraseña';

  @override
  String get loginSubmitButton => 'Entrar';

  @override
  String get loginBackButton => 'Volver';

  @override
  String get loginErrorInvalidCredentials => 'Email o contraseña incorrectos.';

  @override
  String get loginErrorGeneric => 'No pudimos iniciar sesión. Probá de nuevo.';

  @override
  String get registerTitle => 'Crear cuenta';

  @override
  String get registerNameLabel => 'Nombre';

  @override
  String get registerEmailLabel => 'Email';

  @override
  String get registerPasswordLabel => 'Contraseña';

  @override
  String get registerInvitationCodeLabel => 'Código de invitación';

  @override
  String get registerSubmitButton => 'Crear cuenta';

  @override
  String get registerGoToLogin => '¿Ya tenés cuenta? Iniciá sesión';

  @override
  String get registerErrorGeneric =>
      'No pudimos crear la cuenta. Probá de nuevo.';

  @override
  String get registerErrorInvitationInvalid =>
      'Ese código de invitación no es válido.';

  @override
  String get registerErrorInvitationUsed =>
      'Ese código de invitación ya se usó.';

  @override
  String get registerErrorInvitationExpired =>
      'Ese código de invitación venció.';

  @override
  String get registerInvitationPendingTitle => 'Tu cuenta ya está creada';

  @override
  String get registerInvitationPendingBody =>
      'El código de invitación no funcionó todavía. Probá de nuevo o continuá sin grupo por ahora; podés cargarlo más tarde desde el onboarding.';

  @override
  String get registerInvitationRetryButton => 'Reintentar código';

  @override
  String get registerInvitationContinueButton =>
      'Continuar sin grupo por ahora';

  @override
  String get onboardingContinueButton => 'Continuar';

  @override
  String get onboardingFinishButton => 'Terminar';

  @override
  String get onboardingErrorGeneric => 'Algo salió mal. Probá de nuevo.';

  @override
  String get onboardingNameHeadline => '¿Cómo te llamamos?';

  @override
  String get onboardingNameSubtitle =>
      'Así te van a ver tus compañeros de grupo.';

  @override
  String get onboardingNameLabel => 'Nombre';

  @override
  String get onboardingLevelHeadline => '¿Cómo está tu inglés ahora mismo?';

  @override
  String get onboardingLevelSubtitle =>
      'Sin presión. Nos vamos a ajustar sobre la marcha, esto solo marca tu punto de partida.';

  @override
  String get onboardingLevelBeginnerTitle => 'Principiante';

  @override
  String get onboardingLevelBeginnerSubtitle =>
      'Conozco algunas palabras y frases simples';

  @override
  String get onboardingLevelIntermediateTitle => 'Intermedio';

  @override
  String get onboardingLevelIntermediateSubtitle =>
      'Puedo sostener una conversación pero cometo errores';

  @override
  String get onboardingLevelAdvancedTitle => 'Avanzado';

  @override
  String get onboardingLevelAdvancedSubtitle =>
      'Soy fluido y quiero pulir matices';

  @override
  String get onboardingInterestsHeadline => '¿De qué te gusta hablar?';

  @override
  String get onboardingInterestsSubtitle =>
      'Elegí al menos 3. Los usamos para elegir noticias y temas para tus sesiones.';

  @override
  String onboardingInterestsSelectedCount(int count) {
    return '$count seleccionados';
  }

  @override
  String get onboardingInterestsSeeMore => 'Ver más';

  @override
  String get interestTechnology => 'Tecnología';

  @override
  String get interestVideogames => 'Videojuegos';

  @override
  String get interestMoviesSeries => 'Cine y series';

  @override
  String get interestMusic => 'Música';

  @override
  String get interestSports => 'Deportes';

  @override
  String get interestFootball => 'Fútbol';

  @override
  String get interestTravel => 'Viajes';

  @override
  String get interestCooking => 'Comida y cocina';

  @override
  String get interestHealthFitness => 'Salud y fitness';

  @override
  String get interestScience => 'Ciencia';

  @override
  String get interestSpace => 'Espacio';

  @override
  String get interestBusinessEntrepreneurship => 'Negocios y emprendimiento';

  @override
  String get interestPersonalFinance => 'Finanzas personales';

  @override
  String get interestArtificialIntelligence => 'Inteligencia artificial';

  @override
  String get interestCarsMotor => 'Coches y motor';

  @override
  String get interestFashion => 'Moda';

  @override
  String get interestPhotography => 'Fotografía';

  @override
  String get interestArtDesign => 'Arte y diseño';

  @override
  String get interestBooksLiterature => 'Libros y literatura';

  @override
  String get interestHistory => 'Historia';

  @override
  String get interestNatureAnimals => 'Naturaleza y animales';

  @override
  String get interestEnvironment => 'Medio ambiente';

  @override
  String get interestEducationCareer => 'Educación y carrera';

  @override
  String get interestFamilyRelationships => 'Vida familiar y relaciones';

  @override
  String get providersTitle => 'Proveedores y modelos';

  @override
  String get providersGoPractice => 'Listo, ir a practicar';

  @override
  String get providersOpenRouterTitle => 'OpenRouter';

  @override
  String get providersGeminiTitle => 'Gemini';

  @override
  String get providersGeminiRecommendedBadge => 'Recomendado';

  @override
  String get providersStatusConnected => 'Conectado';

  @override
  String get providersStatusNotConnected => 'No conectado';

  @override
  String get providersStatusError => 'Con error';

  @override
  String get providersConnectButton => 'Conectar';

  @override
  String get providersDisconnectButton => 'Desconectar';

  @override
  String providersCreditsRemaining(String amount) {
    return 'Crédito restante: $amount USD';
  }

  @override
  String get providersErrorGeneric =>
      'No pudimos completar la conexión. Probá de nuevo.';

  @override
  String get providersOauthError =>
      'No pudimos conectar con OpenRouter. Probá de nuevo.';

  @override
  String get providersLoadError => 'No pudimos cargar los proveedores.';

  @override
  String get providersGeminiPasteKeyButton => 'Pegar API key';

  @override
  String get providersGeminiKeyDialogTitle => 'Conectar Gemini';

  @override
  String get providersGeminiKeyLabel => 'API key de Gemini';

  @override
  String get providersGeminiKeyHelpStep1 => '1. Entrá a';

  @override
  String get providersGeminiKeyHelpStep2 => '2. Creá una API key nueva';

  @override
  String get providersGeminiKeyHelpStep3 => '3. Copiala y pegala acá';

  @override
  String get providersGeminiKeyLink => 'aistudio.google.com/apikey';

  @override
  String get providersGeminiKeyInvalid => 'Esa API key no es válida.';

  @override
  String get providersGeminiKeyCancel => 'Cancelar';

  @override
  String get providersGeminiKeyConfirm => 'Conectar';

  @override
  String get providersModelChatTitle => 'Modelo para conversar';

  @override
  String get providersModelBriefTitle => 'Modelo para el coach';

  @override
  String get providersModelTierFree => 'Gratis';

  @override
  String get providersModelTierBudget => 'Económico';

  @override
  String get providersModelTierPremium => 'Premium';

  @override
  String get providersModelEstimateFree => 'Gratis';

  @override
  String providersModelEstimatePaid(String amount) {
    return '≈ $amount USD por sesión';
  }

  @override
  String get providersModelProviderDisabledHint =>
      'Conectá este proveedor para usarlo';

  @override
  String get homeNeedProviderHint =>
      'Conectá un proveedor para poder practicar';

  @override
  String homeGreetingMorning(String name) {
    return 'Buen día, $name';
  }

  @override
  String homeGreetingAfternoon(Object name) {
    return 'Buenas tardes, $name';
  }

  @override
  String homeGreetingEvening(Object name) {
    return 'Buenas noches, $name';
  }

  @override
  String homeStreakDays(int count) {
    return '$count días de racha';
  }

  @override
  String get homeGraceDayAvailable => 'Día de gracia disponible esta semana';

  @override
  String homeXpToNextLevel(int amount) {
    return '$amount XP para subir de nivel';
  }

  @override
  String get homePracticeButton => 'Practicar 10 min';

  @override
  String get homeBossButton => 'Boss battle';

  @override
  String get homeBossSkip => 'Hoy no';

  @override
  String homeSessionsTodayStatus(int done) {
    return '$done de 2 sesiones hoy';
  }

  @override
  String get homeGroupCardTitle => 'Tu grupo esta semana';

  @override
  String get homeGroupSeeAll => 'Ver todo';

  @override
  String homeGroupYourPosition(int position) {
    return 'Tu posición: #$position';
  }

  @override
  String homePendingFactsCard(int count) {
    return 'Tengo $count cosas nuevas para recordar de vos, ¿las revisás?';
  }

  @override
  String get homeNoProviderBanner => 'Conectá un proveedor para practicar';

  @override
  String get homeNoProviderAction => 'Conectar';

  @override
  String get homePendingActionWeeklySummaryCredential =>
      'El resumen semanal del grupo no se pudo generar: conectá un proveedor para que siga funcionando.';

  @override
  String get homePendingActionAction => 'Revisar';

  @override
  String get homeQuickTopicsTitle => 'Temas rápidos';

  @override
  String get homeQuickTopicsSeeAll => 'Ver todo';

  @override
  String get homeLoadError => 'No pudimos cargar tu inicio.';

  @override
  String get sessionNewTitle => 'Elegí un tema';

  @override
  String get sessionNewTabTopics => 'Temas';

  @override
  String get sessionNewTabRoleplay => 'Roleplay';

  @override
  String get sessionNewTabNews => 'Noticias';

  @override
  String get sessionNewSurpriseMe => 'Sorprendeme';

  @override
  String get sessionNewSurpriseMeHint =>
      'Dejá que tu coach elija según lo que practicaste';

  @override
  String get sessionNewFreeTopicLabel => 'O escribí tu propio tema';

  @override
  String get sessionNewFreeTopicSubmit => 'Empezar';

  @override
  String get sessionNewTalkAboutButton => 'Hablar de esto';

  @override
  String get sessionNewErrorGeneric =>
      'No pudimos empezar la sesión. Probá de nuevo.';

  @override
  String get micPermissionTitle => 'Necesitamos tu micrófono';

  @override
  String get micPermissionBody =>
      'Fluent usa el micrófono del teléfono para escucharte durante la conversación. La transcripción se procesa en tu dispositivo y vos la revisás antes de enviarla.';

  @override
  String get micPermissionContinue => 'Continuar';

  @override
  String get conversationEndButton => 'Terminar';

  @override
  String get conversationEndConfirmTitle => '¿Terminar la sesión?';

  @override
  String get conversationEndConfirmBody =>
      'Vas a perder el turno que no enviaste.';

  @override
  String get conversationEndConfirmCancel => 'Seguir practicando';

  @override
  String get conversationEndConfirmConfirm => 'Terminar';

  @override
  String get conversationTwoMinutesWarning => '2 minutos';

  @override
  String get conversationTapToSpeak =>
      'Tocá el micrófono y hablá, te vamos a escuchar';

  @override
  String get conversationListeningHint => 'Escuchando…';

  @override
  String get conversationEditableHint => 'Editá tu respuesta antes de enviar';

  @override
  String get conversationSendButton => 'Enviar';

  @override
  String get conversationRetryButton => 'Repetir';

  @override
  String get conversationTextFieldHint => 'O escribí tu respuesta…';

  @override
  String get conversationTextModeButton => 'Escribir';

  @override
  String get conversationVoiceModeButton => 'Hablar';

  @override
  String conversationCorrectionChip(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count correcciones',
      one: '1 corrección',
    );
    return '$_temp0';
  }

  @override
  String get conversationCorrectionOriginalLabel => 'Dijiste';

  @override
  String get conversationCorrectionCorrectedLabel => 'Mejor así';

  @override
  String get conversationDegradedChip => 'Usé un modelo alternativo';

  @override
  String get conversationUnavailableTitle => 'El tutor no está disponible';

  @override
  String get conversationUnavailableBody =>
      'No pudimos conectar con el modelo varias veces seguidas. ¿Querés terminar la sesión?';

  @override
  String get conversationUnavailableEnd => 'Terminar sesión';

  @override
  String get conversationUnavailableStay => 'Seguir esperando';

  @override
  String get conversationSendErrorGeneric =>
      'No pudimos enviar tu mensaje. Probá de nuevo.';

  @override
  String get conversationBootErrorBack => 'Volver';

  @override
  String get conversationMicUnavailableTitle => 'No hay reconocimiento de voz';

  @override
  String get conversationMicUnavailableBody =>
      'Tu dispositivo no tiene reconocimiento de voz en inglés instalado. Podés escribir en modo texto.';

  @override
  String get conversationMicUnavailableAccept => 'Entendido';

  @override
  String conversationSpeedButtonLabel(String rate) {
    return '${rate}x';
  }

  @override
  String get conversationReplayAudio => 'Repetir audio';

  @override
  String get summaryTitle => '¡Excelente sesión!';

  @override
  String get summaryXpEarnedLabel => 'XP ganado';

  @override
  String get summaryStreakLabel => 'Racha';

  @override
  String get summaryDurationLabel => 'Duración';

  @override
  String get summaryCorrectionsTitle => 'Correcciones';

  @override
  String get summaryCorrectionsEmpty => 'Sin correcciones esta vez, ¡muy bien!';

  @override
  String get summaryNextIsBossBanner => 'La próxima sesión es un Boss battle';

  @override
  String get summaryDoubleDayBadge =>
      '¡Segunda sesión del día! Bonus desbloqueado';

  @override
  String get summaryBackButton => 'Volver';

  @override
  String get memoryTitle => 'Lo que recuerdo de vos';

  @override
  String get memoryPendingSectionTitle => 'Para confirmar';

  @override
  String get memoryConfirmedSectionTitle => 'Lo que recuerdo';

  @override
  String get memoryConfirmedEmpty => 'Todavía no hay hechos confirmados.';

  @override
  String get memoryConfirmFact => 'Confirmar';

  @override
  String get memoryDismissFact => 'Descartar';

  @override
  String get memoryEditFactTitle => 'Editar hecho';

  @override
  String get memoryEditFactCancel => 'Cancelar';

  @override
  String get memoryEditFactSave => 'Guardar';

  @override
  String get memoryBriefSectionTitle => 'Notas del coach';

  @override
  String get memoryBriefExplanation =>
      'El tutor lee esto antes de cada sesión para ajustar cómo te habla.';

  @override
  String get memoryBriefSaveButton => 'Guardar';

  @override
  String get memoryForgetAllButton => 'Olvidar todo';

  @override
  String get memoryForgetAllConfirmTitle1 =>
      '¿Olvidar todo lo que recuerda el tutor de vos?';

  @override
  String get memoryForgetAllConfirmBody1 =>
      'Se van a borrar todos los hechos confirmados y las notas del coach.';

  @override
  String get memoryForgetAllConfirmTitle2 => 'Esto no se puede deshacer';

  @override
  String get memoryForgetAllConfirmBody2 =>
      'Confirmá de nuevo para borrar toda tu memoria.';

  @override
  String get memoryForgetAllCancel => 'Cancelar';

  @override
  String get memoryForgetAllConfirm => 'Sí, olvidar todo';

  @override
  String get groupTitle => 'Grupo';

  @override
  String get groupLeaderboardTitle => 'Tu grupo esta semana';

  @override
  String groupStreak(int count) {
    return '$count días en racha grupal';
  }

  @override
  String get groupChallengesTitle => 'Desafíos';

  @override
  String groupChallengeText(String name, String topic) {
    return '$name practicó sobre $topic, ¿te animás?';
  }

  @override
  String get groupChallengeAccept => 'Aceptar';

  @override
  String get groupWeeklySummaryTitle => 'Resumen semanal';

  @override
  String get groupShareButton => 'Compartir en WhatsApp';

  @override
  String get progressTitle => 'Tu progreso';

  @override
  String get progressXpLabel => 'XP';

  @override
  String get progressStreakLabel => 'Racha';

  @override
  String get progressLongestStreakLabel => 'Racha más larga';

  @override
  String get progressSessionsThisWeekLabel => 'Sesiones esta semana';

  @override
  String get progressCorrectionsTrendTitle => 'Tendencia de correcciones';

  @override
  String get progressCorrectionsTrendEmpty =>
      'Todavía no hay suficientes datos.';

  @override
  String progressCorrectionsTrendCounts(int count7d, int count30d) {
    return '$count7d en 7 días · $count30d en 30 días';
  }

  @override
  String get settingsTitle => 'Ajustes';

  @override
  String get settingsLanguageTitle => 'Idioma';

  @override
  String get settingsLanguageSystem => 'Detectar del sistema';

  @override
  String get settingsLanguageSpanish => 'Español';

  @override
  String get settingsLanguagePortuguese => 'Português (Brasil)';

  @override
  String get settingsRemindersTitle => 'Recordatorios';

  @override
  String get settingsMorningReminder => 'Sesión de la mañana';

  @override
  String get settingsEveningReminder => 'Sesión de la tarde';

  @override
  String get settingsStreakAlert => 'Alerta de racha en riesgo';

  @override
  String get settingsSoundEffects => 'Efectos de sonido';

  @override
  String get settingsLogout => 'Cerrar sesión';

  @override
  String get settingsDeleteAccount => 'Borrar cuenta';

  @override
  String get settingsDeleteAccountConfirmTitle => '¿Borrar tu cuenta?';

  @override
  String get settingsDeleteAccountConfirmBody =>
      'Se borran tus sesiones, hechos y preferencias. No se puede deshacer.';

  @override
  String get settingsDeleteAccountCancel => 'Cancelar';

  @override
  String get settingsDeleteAccountConfirm => 'Borrar cuenta';

  @override
  String get authOfflineTitle => 'No pudimos conectar';

  @override
  String get authOfflineBody =>
      'Revisá tu conexión a internet y probá de nuevo. Tu sesión sigue guardada.';

  @override
  String get authRetry => 'Reintentar';
}
