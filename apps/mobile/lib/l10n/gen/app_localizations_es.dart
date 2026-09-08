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
  String get interestTravel => 'Viajes';

  @override
  String get interestBusiness => 'Negocios';

  @override
  String get interestTech => 'Tecnología';

  @override
  String get interestSports => 'Deportes';

  @override
  String get interestMovies => 'Películas';

  @override
  String get interestFood => 'Comida';

  @override
  String get interestDailyLife => 'Vida diaria';

  @override
  String get interestNews => 'Noticias';

  @override
  String get interestMusic => 'Música';

  @override
  String get interestGaming => 'Videojuegos';

  @override
  String get interestFitness => 'Fitness';

  @override
  String get interestBooks => 'Libros';

  @override
  String get interestArt => 'Arte';

  @override
  String get interestScience => 'Ciencia';

  @override
  String get interestCooking => 'Cocina';

  @override
  String get interestPhotography => 'Fotografía';

  @override
  String get interestFashion => 'Moda';

  @override
  String get interestCars => 'Autos';

  @override
  String get interestNature => 'Naturaleza';

  @override
  String get interestPolitics => 'Política';

  @override
  String get interestHistory => 'Historia';

  @override
  String get interestHealth => 'Salud';

  @override
  String get interestFinance => 'Finanzas';

  @override
  String get interestPets => 'Mascotas';

  @override
  String get providersTitle => 'Proveedores y modelos';

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
}
