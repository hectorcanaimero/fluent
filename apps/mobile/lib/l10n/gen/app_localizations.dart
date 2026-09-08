import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_es.dart';
import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('es'),
    Locale('pt'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In es, this message translates to:
  /// **'Fluent'**
  String get appTitle;

  /// No description provided for @splashLoading.
  ///
  /// In es, this message translates to:
  /// **'Cargando…'**
  String get splashLoading;

  /// No description provided for @tabHome.
  ///
  /// In es, this message translates to:
  /// **'Home'**
  String get tabHome;

  /// No description provided for @tabPractice.
  ///
  /// In es, this message translates to:
  /// **'Practicar'**
  String get tabPractice;

  /// No description provided for @tabGroup.
  ///
  /// In es, this message translates to:
  /// **'Grupo'**
  String get tabGroup;

  /// No description provided for @tabProgress.
  ///
  /// In es, this message translates to:
  /// **'Progreso'**
  String get tabProgress;

  /// No description provided for @comingSoonTitle.
  ///
  /// In es, this message translates to:
  /// **'Muy pronto'**
  String get comingSoonTitle;

  /// No description provided for @formFieldRequired.
  ///
  /// In es, this message translates to:
  /// **'Este campo es obligatorio.'**
  String get formFieldRequired;

  /// No description provided for @loginWelcomeHeadline.
  ///
  /// In es, this message translates to:
  /// **'Hablá inglés con confianza, de a 10 minutos'**
  String get loginWelcomeHeadline;

  /// No description provided for @loginWelcomeSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Fluent es tu coach de conversación personal. Dos sesiones cortas por día, sobre temas que realmente te interesan.'**
  String get loginWelcomeSubtitle;

  /// No description provided for @loginBenefit1.
  ///
  /// In es, this message translates to:
  /// **'Conversaciones reales con un tutor de IA'**
  String get loginBenefit1;

  /// No description provided for @loginBenefit2.
  ///
  /// In es, this message translates to:
  /// **'Hablá de las noticias de hoy, a tu manera'**
  String get loginBenefit2;

  /// No description provided for @loginBenefit3.
  ///
  /// In es, this message translates to:
  /// **'Construí una racha que se sostiene'**
  String get loginBenefit3;

  /// No description provided for @loginGetStartedButton.
  ///
  /// In es, this message translates to:
  /// **'Crear cuenta'**
  String get loginGetStartedButton;

  /// No description provided for @loginAlreadyHaveAccount.
  ///
  /// In es, this message translates to:
  /// **'¿Ya tenés una cuenta? Iniciá sesión'**
  String get loginAlreadyHaveAccount;

  /// No description provided for @loginEmailLabel.
  ///
  /// In es, this message translates to:
  /// **'Email'**
  String get loginEmailLabel;

  /// No description provided for @loginPasswordLabel.
  ///
  /// In es, this message translates to:
  /// **'Contraseña'**
  String get loginPasswordLabel;

  /// No description provided for @loginSubmitButton.
  ///
  /// In es, this message translates to:
  /// **'Entrar'**
  String get loginSubmitButton;

  /// No description provided for @loginBackButton.
  ///
  /// In es, this message translates to:
  /// **'Volver'**
  String get loginBackButton;

  /// No description provided for @loginErrorInvalidCredentials.
  ///
  /// In es, this message translates to:
  /// **'Email o contraseña incorrectos.'**
  String get loginErrorInvalidCredentials;

  /// No description provided for @loginErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'No pudimos iniciar sesión. Probá de nuevo.'**
  String get loginErrorGeneric;

  /// No description provided for @registerTitle.
  ///
  /// In es, this message translates to:
  /// **'Crear cuenta'**
  String get registerTitle;

  /// No description provided for @registerNameLabel.
  ///
  /// In es, this message translates to:
  /// **'Nombre'**
  String get registerNameLabel;

  /// No description provided for @registerEmailLabel.
  ///
  /// In es, this message translates to:
  /// **'Email'**
  String get registerEmailLabel;

  /// No description provided for @registerPasswordLabel.
  ///
  /// In es, this message translates to:
  /// **'Contraseña'**
  String get registerPasswordLabel;

  /// No description provided for @registerInvitationCodeLabel.
  ///
  /// In es, this message translates to:
  /// **'Código de invitación'**
  String get registerInvitationCodeLabel;

  /// No description provided for @registerSubmitButton.
  ///
  /// In es, this message translates to:
  /// **'Crear cuenta'**
  String get registerSubmitButton;

  /// No description provided for @registerGoToLogin.
  ///
  /// In es, this message translates to:
  /// **'¿Ya tenés cuenta? Iniciá sesión'**
  String get registerGoToLogin;

  /// No description provided for @registerErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'No pudimos crear la cuenta. Probá de nuevo.'**
  String get registerErrorGeneric;

  /// No description provided for @registerErrorInvitationInvalid.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación no es válido.'**
  String get registerErrorInvitationInvalid;

  /// No description provided for @registerErrorInvitationUsed.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación ya se usó.'**
  String get registerErrorInvitationUsed;

  /// No description provided for @registerErrorInvitationExpired.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación venció.'**
  String get registerErrorInvitationExpired;

  /// No description provided for @registerInvitationPendingTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu cuenta ya está creada'**
  String get registerInvitationPendingTitle;

  /// No description provided for @registerInvitationPendingBody.
  ///
  /// In es, this message translates to:
  /// **'El código de invitación no funcionó todavía. Probá de nuevo o continuá sin grupo por ahora; podés cargarlo más tarde desde el onboarding.'**
  String get registerInvitationPendingBody;

  /// No description provided for @registerInvitationRetryButton.
  ///
  /// In es, this message translates to:
  /// **'Reintentar código'**
  String get registerInvitationRetryButton;

  /// No description provided for @registerInvitationContinueButton.
  ///
  /// In es, this message translates to:
  /// **'Continuar sin grupo por ahora'**
  String get registerInvitationContinueButton;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['es', 'pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'es':
      return AppLocalizationsEs();
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
