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
}
