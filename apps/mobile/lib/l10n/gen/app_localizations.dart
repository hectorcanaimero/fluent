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
  /// **'Open Fluent'**
  String get appTitle;

  /// No description provided for @splashLoading.
  ///
  /// In es, this message translates to:
  /// **'Cargando…'**
  String get splashLoading;

  /// No description provided for @tabHome.
  ///
  /// In es, this message translates to:
  /// **'Inicio'**
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

  /// No description provided for @commonLoadErrorTitle.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar esto'**
  String get commonLoadErrorTitle;

  /// No description provided for @commonLoadErrorBody.
  ///
  /// In es, this message translates to:
  /// **'Revisá tu conexión y probá de nuevo.'**
  String get commonLoadErrorBody;

  /// No description provided for @commonRetry.
  ///
  /// In es, this message translates to:
  /// **'Reintentar'**
  String get commonRetry;

  /// No description provided for @errorGeneric.
  ///
  /// In es, this message translates to:
  /// **'Ocurrió un error. Probá de nuevo.'**
  String get errorGeneric;

  /// No description provided for @errorUnauthenticated.
  ///
  /// In es, this message translates to:
  /// **'Tu sesión venció. Volvé a entrar.'**
  String get errorUnauthenticated;

  /// No description provided for @errorForbidden.
  ///
  /// In es, this message translates to:
  /// **'No tenés permiso para hacer eso.'**
  String get errorForbidden;

  /// No description provided for @errorNotOnboarded.
  ///
  /// In es, this message translates to:
  /// **'Todavía te falta completar tu perfil.'**
  String get errorNotOnboarded;

  /// No description provided for @errorValidation.
  ///
  /// In es, this message translates to:
  /// **'Revisá los datos y probá de nuevo.'**
  String get errorValidation;

  /// No description provided for @errorInvitationInvalid.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación no es válido.'**
  String get errorInvitationInvalid;

  /// No description provided for @errorInvitationUsed.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación ya se usó.'**
  String get errorInvitationUsed;

  /// No description provided for @errorInvitationExpired.
  ///
  /// In es, this message translates to:
  /// **'Ese código de invitación venció.'**
  String get errorInvitationExpired;

  /// No description provided for @errorAlreadyInGroup.
  ///
  /// In es, this message translates to:
  /// **'Ya estás en un grupo.'**
  String get errorAlreadyInGroup;

  /// No description provided for @errorProviderNotConnected.
  ///
  /// In es, this message translates to:
  /// **'Conectá tu cuenta de IA para poder practicar.'**
  String get errorProviderNotConnected;

  /// No description provided for @errorProviderKeyInvalid.
  ///
  /// In es, this message translates to:
  /// **'Esa clave no es válida.'**
  String get errorProviderKeyInvalid;

  /// No description provided for @errorModelNotAvailable.
  ///
  /// In es, this message translates to:
  /// **'Ese modelo no está disponible ahora.'**
  String get errorModelNotAvailable;

  /// No description provided for @errorSessionNotActive.
  ///
  /// In es, this message translates to:
  /// **'Esa sesión ya no está activa.'**
  String get errorSessionNotActive;

  /// No description provided for @errorSessionAlreadyActive.
  ///
  /// In es, this message translates to:
  /// **'Ya tenés una sesión abierta.'**
  String get errorSessionAlreadyActive;

  /// No description provided for @errorLlmUnavailable.
  ///
  /// In es, this message translates to:
  /// **'El tutor no está disponible ahora. Probá de nuevo en un rato.'**
  String get errorLlmUnavailable;

  /// No description provided for @errorRateLimited.
  ///
  /// In es, this message translates to:
  /// **'Hiciste muchas peticiones seguidas. Esperá un momento.'**
  String get errorRateLimited;

  /// No description provided for @errorNotReady.
  ///
  /// In es, this message translates to:
  /// **'Todavía no está listo. Probá de nuevo en un momento.'**
  String get errorNotReady;

  /// No description provided for @errorNotFound.
  ///
  /// In es, this message translates to:
  /// **'No encontramos eso.'**
  String get errorNotFound;

  /// No description provided for @errorInternal.
  ///
  /// In es, this message translates to:
  /// **'Tuvimos un problema de nuestro lado. Probá de nuevo.'**
  String get errorInternal;

  /// No description provided for @errorChallengeNotAvailable.
  ///
  /// In es, this message translates to:
  /// **'Ese desafío ya no está disponible.'**
  String get errorChallengeNotAvailable;

  /// No description provided for @errorTurnsDailyCap.
  ///
  /// In es, this message translates to:
  /// **'Por hoy alcanzaste el máximo de turnos. Mañana seguimos.'**
  String get errorTurnsDailyCap;

  /// No description provided for @errorStreamTimeout.
  ///
  /// In es, this message translates to:
  /// **'El tutor tardó en responder. Probá de nuevo.'**
  String get errorStreamTimeout;

  /// No description provided for @formFieldRequired.
  ///
  /// In es, this message translates to:
  /// **'Este campo es obligatorio.'**
  String get formFieldRequired;

  /// No description provided for @welcomeSlide1Title.
  ///
  /// In es, this message translates to:
  /// **'Un tutor que se acuerda de vos'**
  String get welcomeSlide1Title;

  /// No description provided for @welcomeSlide1Body.
  ///
  /// In es, this message translates to:
  /// **'Hablá de tu trabajo, tu viaje o tu entrevista. Te corrige al momento, sin cortarte.'**
  String get welcomeSlide1Body;

  /// No description provided for @welcomeSlide2Title.
  ///
  /// In es, this message translates to:
  /// **'Practicá con tus amigos'**
  String get welcomeSlide2Title;

  /// No description provided for @welcomeSlide2Body.
  ///
  /// In es, this message translates to:
  /// **'Sumate con el código de un amigo o invitá a los tuyos. Cada sesión suma en el ranking.'**
  String get welcomeSlide2Body;

  /// No description provided for @welcomeSlide3Title.
  ///
  /// In es, this message translates to:
  /// **'10 minutos, dos veces al día'**
  String get welcomeSlide3Title;

  /// No description provided for @welcomeSlide3Body.
  ///
  /// In es, this message translates to:
  /// **'Una sesión a la mañana y otra a la noche, con tu propia cuenta de IA gratis.'**
  String get welcomeSlide3Body;

  /// No description provided for @welcomeRankingYou.
  ///
  /// In es, this message translates to:
  /// **'Vos'**
  String get welcomeRankingYou;

  /// No description provided for @welcomeSessionMorning.
  ///
  /// In es, this message translates to:
  /// **'Mañana'**
  String get welcomeSessionMorning;

  /// No description provided for @welcomeSessionEvening.
  ///
  /// In es, this message translates to:
  /// **'Noche'**
  String get welcomeSessionEvening;

  /// No description provided for @welcomeStreakDays.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{1 día} other{{count} días}}'**
  String welcomeStreakDays(int count);

  /// No description provided for @welcomePageLabel.
  ///
  /// In es, this message translates to:
  /// **'Página {current} de {total}'**
  String welcomePageLabel(int current, int total);

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

  /// No description provided for @notFoundTitle.
  ///
  /// In es, this message translates to:
  /// **'Esa pantalla no existe'**
  String get notFoundTitle;

  /// No description provided for @notFoundBody.
  ///
  /// In es, this message translates to:
  /// **'El enlace que abriste no lleva a ningún lado.'**
  String get notFoundBody;

  /// No description provided for @notFoundGoHome.
  ///
  /// In es, this message translates to:
  /// **'Ir al inicio'**
  String get notFoundGoHome;

  /// No description provided for @onboardingContinueButton.
  ///
  /// In es, this message translates to:
  /// **'Continuar'**
  String get onboardingContinueButton;

  /// No description provided for @onboardingFinishButton.
  ///
  /// In es, this message translates to:
  /// **'Terminar'**
  String get onboardingFinishButton;

  /// No description provided for @onboardingErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'Algo salió mal. Probá de nuevo.'**
  String get onboardingErrorGeneric;

  /// No description provided for @onboardingLevelHeadline.
  ///
  /// In es, this message translates to:
  /// **'¿Cómo está tu inglés ahora mismo?'**
  String get onboardingLevelHeadline;

  /// No description provided for @onboardingLevelSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Sin presión. Nos vamos a ajustar sobre la marcha, esto solo marca tu punto de partida.'**
  String get onboardingLevelSubtitle;

  /// No description provided for @onboardingLevelBeginnerTitle.
  ///
  /// In es, this message translates to:
  /// **'Principiante'**
  String get onboardingLevelBeginnerTitle;

  /// No description provided for @onboardingLevelBeginnerSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Conozco algunas palabras y frases simples'**
  String get onboardingLevelBeginnerSubtitle;

  /// No description provided for @onboardingLevelIntermediateTitle.
  ///
  /// In es, this message translates to:
  /// **'Intermedio'**
  String get onboardingLevelIntermediateTitle;

  /// No description provided for @onboardingLevelIntermediateSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Puedo sostener una conversación pero cometo errores'**
  String get onboardingLevelIntermediateSubtitle;

  /// No description provided for @onboardingLevelAdvancedTitle.
  ///
  /// In es, this message translates to:
  /// **'Avanzado'**
  String get onboardingLevelAdvancedTitle;

  /// No description provided for @onboardingLevelAdvancedSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Me defiendo bien y quiero sonar más natural'**
  String get onboardingLevelAdvancedSubtitle;

  /// No description provided for @onboardingInterestsHeadline.
  ///
  /// In es, this message translates to:
  /// **'¿De qué te gusta hablar?'**
  String get onboardingInterestsHeadline;

  /// No description provided for @onboardingInterestsSubtitle.
  ///
  /// In es, this message translates to:
  /// **'Elegí al menos 3. Los usamos para elegir noticias y temas para tus sesiones.'**
  String get onboardingInterestsSubtitle;

  /// No description provided for @onboardingInterestsSelectedCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{1 seleccionado} other{{count} seleccionados}}'**
  String onboardingInterestsSelectedCount(int count);

  /// No description provided for @onboardingInterestsSeeMore.
  ///
  /// In es, this message translates to:
  /// **'Ver más'**
  String get onboardingInterestsSeeMore;

  /// No description provided for @interestTechnology.
  ///
  /// In es, this message translates to:
  /// **'Tecnología'**
  String get interestTechnology;

  /// No description provided for @interestVideogames.
  ///
  /// In es, this message translates to:
  /// **'Videojuegos'**
  String get interestVideogames;

  /// No description provided for @interestMoviesSeries.
  ///
  /// In es, this message translates to:
  /// **'Cine y series'**
  String get interestMoviesSeries;

  /// No description provided for @interestMusic.
  ///
  /// In es, this message translates to:
  /// **'Música'**
  String get interestMusic;

  /// No description provided for @interestSports.
  ///
  /// In es, this message translates to:
  /// **'Deportes'**
  String get interestSports;

  /// No description provided for @interestFootball.
  ///
  /// In es, this message translates to:
  /// **'Fútbol'**
  String get interestFootball;

  /// No description provided for @interestTravel.
  ///
  /// In es, this message translates to:
  /// **'Viajes'**
  String get interestTravel;

  /// No description provided for @interestCooking.
  ///
  /// In es, this message translates to:
  /// **'Comida y cocina'**
  String get interestCooking;

  /// No description provided for @interestHealthFitness.
  ///
  /// In es, this message translates to:
  /// **'Salud y fitness'**
  String get interestHealthFitness;

  /// No description provided for @interestScience.
  ///
  /// In es, this message translates to:
  /// **'Ciencia'**
  String get interestScience;

  /// No description provided for @interestSpace.
  ///
  /// In es, this message translates to:
  /// **'Espacio'**
  String get interestSpace;

  /// No description provided for @interestBusinessEntrepreneurship.
  ///
  /// In es, this message translates to:
  /// **'Negocios y emprendimiento'**
  String get interestBusinessEntrepreneurship;

  /// No description provided for @interestPersonalFinance.
  ///
  /// In es, this message translates to:
  /// **'Finanzas personales'**
  String get interestPersonalFinance;

  /// No description provided for @interestArtificialIntelligence.
  ///
  /// In es, this message translates to:
  /// **'Inteligencia artificial'**
  String get interestArtificialIntelligence;

  /// No description provided for @interestCarsMotor.
  ///
  /// In es, this message translates to:
  /// **'Autos y motor'**
  String get interestCarsMotor;

  /// No description provided for @interestFashion.
  ///
  /// In es, this message translates to:
  /// **'Moda'**
  String get interestFashion;

  /// No description provided for @interestPhotography.
  ///
  /// In es, this message translates to:
  /// **'Fotografía'**
  String get interestPhotography;

  /// No description provided for @interestArtDesign.
  ///
  /// In es, this message translates to:
  /// **'Arte y diseño'**
  String get interestArtDesign;

  /// No description provided for @interestBooksLiterature.
  ///
  /// In es, this message translates to:
  /// **'Libros y literatura'**
  String get interestBooksLiterature;

  /// No description provided for @interestHistory.
  ///
  /// In es, this message translates to:
  /// **'Historia'**
  String get interestHistory;

  /// No description provided for @interestNatureAnimals.
  ///
  /// In es, this message translates to:
  /// **'Naturaleza y animales'**
  String get interestNatureAnimals;

  /// No description provided for @interestEnvironment.
  ///
  /// In es, this message translates to:
  /// **'Medio ambiente'**
  String get interestEnvironment;

  /// No description provided for @interestEducationCareer.
  ///
  /// In es, this message translates to:
  /// **'Educación y carrera'**
  String get interestEducationCareer;

  /// No description provided for @interestFamilyRelationships.
  ///
  /// In es, this message translates to:
  /// **'Vida familiar y relaciones'**
  String get interestFamilyRelationships;

  /// No description provided for @providersTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu cuenta de IA'**
  String get providersTitle;

  /// No description provided for @providersGoPractice.
  ///
  /// In es, this message translates to:
  /// **'Listo, ir a practicar'**
  String get providersGoPractice;

  /// No description provided for @providersOpenRouterTitle.
  ///
  /// In es, this message translates to:
  /// **'OpenRouter'**
  String get providersOpenRouterTitle;

  /// No description provided for @providersGeminiTitle.
  ///
  /// In es, this message translates to:
  /// **'Gemini'**
  String get providersGeminiTitle;

  /// No description provided for @providersGeminiRecommendedBadge.
  ///
  /// In es, this message translates to:
  /// **'Recomendado'**
  String get providersGeminiRecommendedBadge;

  /// No description provided for @providersStatusConnected.
  ///
  /// In es, this message translates to:
  /// **'Conectado'**
  String get providersStatusConnected;

  /// No description provided for @providersStatusNotConnected.
  ///
  /// In es, this message translates to:
  /// **'No conectado'**
  String get providersStatusNotConnected;

  /// No description provided for @providersStatusError.
  ///
  /// In es, this message translates to:
  /// **'No funciona: volvé a conectarla'**
  String get providersStatusError;

  /// No description provided for @providersConnectButton.
  ///
  /// In es, this message translates to:
  /// **'Conectar'**
  String get providersConnectButton;

  /// No description provided for @providersDisconnectButton.
  ///
  /// In es, this message translates to:
  /// **'Desconectar'**
  String get providersDisconnectButton;

  /// No description provided for @providersCreditsRemaining.
  ///
  /// In es, this message translates to:
  /// **'Crédito restante: {amount} USD'**
  String providersCreditsRemaining(String amount);

  /// No description provided for @providersErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'No pudimos completar la conexión. Probá de nuevo.'**
  String get providersErrorGeneric;

  /// No description provided for @providersOauthError.
  ///
  /// In es, this message translates to:
  /// **'No pudimos conectar con OpenRouter. Probá de nuevo.'**
  String get providersOauthError;

  /// No description provided for @providersLoadError.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar tus cuentas de IA.'**
  String get providersLoadError;

  /// No description provided for @providersGeminiPasteKeyButton.
  ///
  /// In es, this message translates to:
  /// **'Pegar API key'**
  String get providersGeminiPasteKeyButton;

  /// No description provided for @providersGeminiKeyDialogTitle.
  ///
  /// In es, this message translates to:
  /// **'Conectar Gemini'**
  String get providersGeminiKeyDialogTitle;

  /// No description provided for @providersGeminiKeyLabel.
  ///
  /// In es, this message translates to:
  /// **'API key de Gemini'**
  String get providersGeminiKeyLabel;

  /// No description provided for @providersGeminiKeyHelpStep1.
  ///
  /// In es, this message translates to:
  /// **'1. Entrá a'**
  String get providersGeminiKeyHelpStep1;

  /// No description provided for @providersGeminiKeyHelpStep2.
  ///
  /// In es, this message translates to:
  /// **'2. Creá una API key nueva'**
  String get providersGeminiKeyHelpStep2;

  /// No description provided for @providersGeminiKeyHelpStep3.
  ///
  /// In es, this message translates to:
  /// **'3. Copiala y pegala acá'**
  String get providersGeminiKeyHelpStep3;

  /// No description provided for @providersGeminiKeyLink.
  ///
  /// In es, this message translates to:
  /// **'aistudio.google.com/apikey'**
  String get providersGeminiKeyLink;

  /// No description provided for @providersGeminiKeyInvalid.
  ///
  /// In es, this message translates to:
  /// **'Esa API key no es válida.'**
  String get providersGeminiKeyInvalid;

  /// No description provided for @providersGeminiKeyCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get providersGeminiKeyCancel;

  /// No description provided for @providersGeminiKeyConfirm.
  ///
  /// In es, this message translates to:
  /// **'Conectar'**
  String get providersGeminiKeyConfirm;

  /// No description provided for @providersModelChatTitle.
  ///
  /// In es, this message translates to:
  /// **'Modelo para conversar'**
  String get providersModelChatTitle;

  /// No description provided for @providersModelBriefTitle.
  ///
  /// In es, this message translates to:
  /// **'Modelo para las notas del tutor'**
  String get providersModelBriefTitle;

  /// No description provided for @providersModelTierFree.
  ///
  /// In es, this message translates to:
  /// **'Gratis'**
  String get providersModelTierFree;

  /// No description provided for @providersModelTierBudget.
  ///
  /// In es, this message translates to:
  /// **'Económico'**
  String get providersModelTierBudget;

  /// No description provided for @providersModelTierPremium.
  ///
  /// In es, this message translates to:
  /// **'Mejor calidad'**
  String get providersModelTierPremium;

  /// No description provided for @providersModelEstimateFree.
  ///
  /// In es, this message translates to:
  /// **'Gratis'**
  String get providersModelEstimateFree;

  /// No description provided for @providersModelEstimatePaid.
  ///
  /// In es, this message translates to:
  /// **'≈ {amount} USD por sesión'**
  String providersModelEstimatePaid(String amount);

  /// No description provided for @homeNeedProviderHint.
  ///
  /// In es, this message translates to:
  /// **'Conectá tu cuenta de IA para poder practicar'**
  String get homeNeedProviderHint;

  /// No description provided for @homeGreetingMorning.
  ///
  /// In es, this message translates to:
  /// **'Buen día, {name}'**
  String homeGreetingMorning(String name);

  /// No description provided for @homeGreetingAfternoon.
  ///
  /// In es, this message translates to:
  /// **'Buenas tardes, {name}'**
  String homeGreetingAfternoon(Object name);

  /// No description provided for @homeGreetingEvening.
  ///
  /// In es, this message translates to:
  /// **'Buenas noches, {name}'**
  String homeGreetingEvening(Object name);

  /// No description provided for @homeStreakDays.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{1 día de racha} other{{count} días de racha}}'**
  String homeStreakDays(int count);

  /// No description provided for @streakGraceAvailable.
  ///
  /// In es, this message translates to:
  /// **'Día de gracia disponible esta semana'**
  String get streakGraceAvailable;

  /// No description provided for @streakGraceUsed.
  ///
  /// In es, this message translates to:
  /// **'Gracia usada esta semana: hoy no hay red'**
  String get streakGraceUsed;

  /// No description provided for @homeXpToNextLevel.
  ///
  /// In es, this message translates to:
  /// **'{amount} XP para subir de nivel'**
  String homeXpToNextLevel(int amount);

  /// No description provided for @homePracticeButton.
  ///
  /// In es, this message translates to:
  /// **'Practicar 10 min'**
  String get homePracticeButton;

  /// No description provided for @homeBossButton.
  ///
  /// In es, this message translates to:
  /// **'Sesión desafío'**
  String get homeBossButton;

  /// No description provided for @homeBossSkip.
  ///
  /// In es, this message translates to:
  /// **'Hoy no'**
  String get homeBossSkip;

  /// No description provided for @homeSessionsTodayStatus.
  ///
  /// In es, this message translates to:
  /// **'{done} de 2 sesiones hoy'**
  String homeSessionsTodayStatus(int done);

  /// No description provided for @homeGroupCardTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu grupo esta semana'**
  String get homeGroupCardTitle;

  /// No description provided for @homeGroupSeeAll.
  ///
  /// In es, this message translates to:
  /// **'Ver todo'**
  String get homeGroupSeeAll;

  /// No description provided for @homeGroupYourPosition.
  ///
  /// In es, this message translates to:
  /// **'Tu posición: #{position}'**
  String homeGroupYourPosition(int position);

  /// No description provided for @homePendingFactsCard.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{Tengo 1 cosa nueva para recordar de vos, ¿la revisás?} other{Tengo {count} cosas nuevas para recordar de vos, ¿las revisás?}}'**
  String homePendingFactsCard(int count);

  /// No description provided for @homeNoProviderBanner.
  ///
  /// In es, this message translates to:
  /// **'Conectá tu cuenta de IA para seguir practicando'**
  String get homeNoProviderBanner;

  /// No description provided for @homeNoProviderAction.
  ///
  /// In es, this message translates to:
  /// **'Conectar'**
  String get homeNoProviderAction;

  /// No description provided for @homePendingActionWeeklySummaryCredential.
  ///
  /// In es, this message translates to:
  /// **'El resumen de esta semana necesita tu cuenta de IA. Conectala para que siga saliendo.'**
  String get homePendingActionWeeklySummaryCredential;

  /// No description provided for @homePendingActionAction.
  ///
  /// In es, this message translates to:
  /// **'Revisar'**
  String get homePendingActionAction;

  /// No description provided for @homeQuickTopicsTitle.
  ///
  /// In es, this message translates to:
  /// **'Temas rápidos'**
  String get homeQuickTopicsTitle;

  /// No description provided for @homeQuickTopicsSeeAll.
  ///
  /// In es, this message translates to:
  /// **'Ver todo'**
  String get homeQuickTopicsSeeAll;

  /// No description provided for @homeLoadError.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar tu inicio.'**
  String get homeLoadError;

  /// No description provided for @sessionNewTitle.
  ///
  /// In es, this message translates to:
  /// **'Elegí un tema'**
  String get sessionNewTitle;

  /// No description provided for @sessionNewTabTopics.
  ///
  /// In es, this message translates to:
  /// **'Temas'**
  String get sessionNewTabTopics;

  /// No description provided for @sessionNewTabRoleplay.
  ///
  /// In es, this message translates to:
  /// **'Roleplay'**
  String get sessionNewTabRoleplay;

  /// No description provided for @sessionNewTabNews.
  ///
  /// In es, this message translates to:
  /// **'Noticias'**
  String get sessionNewTabNews;

  /// No description provided for @sessionNewSurpriseMe.
  ///
  /// In es, this message translates to:
  /// **'Sorprendeme'**
  String get sessionNewSurpriseMe;

  /// No description provided for @sessionNewSurpriseMeHint.
  ///
  /// In es, this message translates to:
  /// **'Dejá que tu tutor elija según lo que practicaste'**
  String get sessionNewSurpriseMeHint;

  /// No description provided for @sessionNewFreeTopicLabel.
  ///
  /// In es, this message translates to:
  /// **'O escribí tu propio tema'**
  String get sessionNewFreeTopicLabel;

  /// No description provided for @sessionNewFreeTopicSubmit.
  ///
  /// In es, this message translates to:
  /// **'Empezar'**
  String get sessionNewFreeTopicSubmit;

  /// No description provided for @sessionNewTalkAboutButton.
  ///
  /// In es, this message translates to:
  /// **'Hablar de esto'**
  String get sessionNewTalkAboutButton;

  /// No description provided for @sessionNewErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'No pudimos empezar la sesión. Probá de nuevo.'**
  String get sessionNewErrorGeneric;

  /// No description provided for @micPermissionTitle.
  ///
  /// In es, this message translates to:
  /// **'Necesitamos tu micrófono'**
  String get micPermissionTitle;

  /// No description provided for @micPermissionBody.
  ///
  /// In es, this message translates to:
  /// **'Open Fluent usa el micrófono para escucharte durante la conversación. Tu voz se convierte en texto, nunca guardamos el audio, y vos revisás el texto antes de enviarlo.'**
  String get micPermissionBody;

  /// No description provided for @micPermissionContinue.
  ///
  /// In es, this message translates to:
  /// **'Continuar'**
  String get micPermissionContinue;

  /// No description provided for @conversationEndButton.
  ///
  /// In es, this message translates to:
  /// **'Terminar'**
  String get conversationEndButton;

  /// No description provided for @conversationEndConfirmTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Terminar la sesión?'**
  String get conversationEndConfirmTitle;

  /// No description provided for @conversationEndConfirmBody.
  ///
  /// In es, this message translates to:
  /// **'Vas a perder el turno que no enviaste.'**
  String get conversationEndConfirmBody;

  /// No description provided for @conversationEndConfirmCancel.
  ///
  /// In es, this message translates to:
  /// **'Seguir practicando'**
  String get conversationEndConfirmCancel;

  /// No description provided for @conversationEndConfirmConfirm.
  ///
  /// In es, this message translates to:
  /// **'Terminar'**
  String get conversationEndConfirmConfirm;

  /// No description provided for @conversationTwoMinutesWarning.
  ///
  /// In es, this message translates to:
  /// **'2 minutos'**
  String get conversationTwoMinutesWarning;

  /// No description provided for @conversationTapToSpeak.
  ///
  /// In es, this message translates to:
  /// **'Tocá el micrófono y hablá, te vamos a escuchar'**
  String get conversationTapToSpeak;

  /// No description provided for @conversationListeningHint.
  ///
  /// In es, this message translates to:
  /// **'Escuchando…'**
  String get conversationListeningHint;

  /// No description provided for @conversationListeningSecondsLeft.
  ///
  /// In es, this message translates to:
  /// **'{seconds}s'**
  String conversationListeningSecondsLeft(int seconds);

  /// No description provided for @conversationThinkingHint.
  ///
  /// In es, this message translates to:
  /// **'Pensando…'**
  String get conversationThinkingHint;

  /// No description provided for @conversationSpeakingHint.
  ///
  /// In es, this message translates to:
  /// **'Hablando…'**
  String get conversationSpeakingHint;

  /// No description provided for @conversationStopButton.
  ///
  /// In es, this message translates to:
  /// **'Parar'**
  String get conversationStopButton;

  /// No description provided for @conversationMicButtonSemantics.
  ///
  /// In es, this message translates to:
  /// **'Micrófono, tocá para hablar'**
  String get conversationMicButtonSemantics;

  /// No description provided for @conversationMicButtonListeningSemantics.
  ///
  /// In es, this message translates to:
  /// **'Escuchando, tocá para terminar'**
  String get conversationMicButtonListeningSemantics;

  /// No description provided for @conversationEditableHint.
  ///
  /// In es, this message translates to:
  /// **'Editá tu respuesta antes de enviar'**
  String get conversationEditableHint;

  /// No description provided for @conversationSendButton.
  ///
  /// In es, this message translates to:
  /// **'Enviar'**
  String get conversationSendButton;

  /// No description provided for @conversationRetryButton.
  ///
  /// In es, this message translates to:
  /// **'Repetir'**
  String get conversationRetryButton;

  /// No description provided for @conversationTextFieldHint.
  ///
  /// In es, this message translates to:
  /// **'O escribí tu respuesta…'**
  String get conversationTextFieldHint;

  /// No description provided for @conversationTextModeButton.
  ///
  /// In es, this message translates to:
  /// **'Escribir'**
  String get conversationTextModeButton;

  /// No description provided for @conversationVoiceModeButton.
  ///
  /// In es, this message translates to:
  /// **'Hablar'**
  String get conversationVoiceModeButton;

  /// No description provided for @conversationCorrectionChip.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{1 corrección} other{{count} correcciones}}'**
  String conversationCorrectionChip(int count);

  /// No description provided for @conversationCorrectionOriginalLabel.
  ///
  /// In es, this message translates to:
  /// **'Dijiste'**
  String get conversationCorrectionOriginalLabel;

  /// No description provided for @conversationCorrectionCorrectedLabel.
  ///
  /// In es, this message translates to:
  /// **'Mejor así'**
  String get conversationCorrectionCorrectedLabel;

  /// No description provided for @conversationDegradedChip.
  ///
  /// In es, this message translates to:
  /// **'Respuesta de respaldo'**
  String get conversationDegradedChip;

  /// No description provided for @conversationUnavailableTitle.
  ///
  /// In es, this message translates to:
  /// **'El tutor no está disponible'**
  String get conversationUnavailableTitle;

  /// No description provided for @conversationUnavailableBody.
  ///
  /// In es, this message translates to:
  /// **'No pudimos conectar con el modelo varias veces seguidas. ¿Querés terminar la sesión?'**
  String get conversationUnavailableBody;

  /// No description provided for @conversationUnavailableEnd.
  ///
  /// In es, this message translates to:
  /// **'Terminar sesión'**
  String get conversationUnavailableEnd;

  /// No description provided for @conversationUnavailableStay.
  ///
  /// In es, this message translates to:
  /// **'Seguir esperando'**
  String get conversationUnavailableStay;

  /// No description provided for @conversationSendErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'No pudimos enviar tu mensaje. Probá de nuevo.'**
  String get conversationSendErrorGeneric;

  /// No description provided for @conversationBootErrorBack.
  ///
  /// In es, this message translates to:
  /// **'Volver'**
  String get conversationBootErrorBack;

  /// No description provided for @conversationMicUnavailableTitle.
  ///
  /// In es, this message translates to:
  /// **'No hay reconocimiento de voz'**
  String get conversationMicUnavailableTitle;

  /// No description provided for @conversationMicUnavailableBody.
  ///
  /// In es, this message translates to:
  /// **'Tu dispositivo no tiene reconocimiento de voz en inglés instalado. Podés escribir en modo texto.'**
  String get conversationMicUnavailableBody;

  /// No description provided for @conversationMicUnavailableAccept.
  ///
  /// In es, this message translates to:
  /// **'Entendido'**
  String get conversationMicUnavailableAccept;

  /// No description provided for @conversationMicPermissionDeniedTitle.
  ///
  /// In es, this message translates to:
  /// **'Activá el micrófono'**
  String get conversationMicPermissionDeniedTitle;

  /// No description provided for @conversationMicPermissionDeniedBody.
  ///
  /// In es, this message translates to:
  /// **'Open Fluent necesita permiso de micrófono para escucharte. Activalo en los ajustes del sistema.'**
  String get conversationMicPermissionDeniedBody;

  /// No description provided for @conversationMicPermissionDeniedCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get conversationMicPermissionDeniedCancel;

  /// No description provided for @conversationMicPermissionDeniedOpenSettings.
  ///
  /// In es, this message translates to:
  /// **'Abrir Ajustes'**
  String get conversationMicPermissionDeniedOpenSettings;

  /// No description provided for @conversationSttErrorNoMatch.
  ///
  /// In es, this message translates to:
  /// **'No entendimos lo que dijiste. Probá de nuevo.'**
  String get conversationSttErrorNoMatch;

  /// No description provided for @conversationSttErrorTimeout.
  ///
  /// In es, this message translates to:
  /// **'Se acabó el tiempo de escucha. Probá de nuevo.'**
  String get conversationSttErrorTimeout;

  /// No description provided for @conversationSttErrorGeneric.
  ///
  /// In es, this message translates to:
  /// **'Hubo un problema con el micrófono. Probá de nuevo.'**
  String get conversationSttErrorGeneric;

  /// No description provided for @conversationReplayAudio.
  ///
  /// In es, this message translates to:
  /// **'Repetir audio'**
  String get conversationReplayAudio;

  /// No description provided for @summaryTitle.
  ///
  /// In es, this message translates to:
  /// **'Sesión hecha'**
  String get summaryTitle;

  /// No description provided for @summaryXpEarnedLabel.
  ///
  /// In es, this message translates to:
  /// **'XP ganado'**
  String get summaryXpEarnedLabel;

  /// No description provided for @summaryStreakLabel.
  ///
  /// In es, this message translates to:
  /// **'Racha'**
  String get summaryStreakLabel;

  /// No description provided for @summaryDurationLabel.
  ///
  /// In es, this message translates to:
  /// **'Duración'**
  String get summaryDurationLabel;

  /// No description provided for @summaryCorrectionsTitle.
  ///
  /// In es, this message translates to:
  /// **'Correcciones'**
  String get summaryCorrectionsTitle;

  /// No description provided for @summaryCorrectionsEmpty.
  ///
  /// In es, this message translates to:
  /// **'Sin correcciones esta vez, ¡muy bien!'**
  String get summaryCorrectionsEmpty;

  /// No description provided for @summaryNextIsBossBanner.
  ///
  /// In es, this message translates to:
  /// **'Tu próxima sesión es un desafío'**
  String get summaryNextIsBossBanner;

  /// No description provided for @summaryDoubleDayBadge.
  ///
  /// In es, this message translates to:
  /// **'¡Segunda sesión del día! Bonus desbloqueado'**
  String get summaryDoubleDayBadge;

  /// No description provided for @summaryBackButton.
  ///
  /// In es, this message translates to:
  /// **'Volver'**
  String get summaryBackButton;

  /// No description provided for @memoryTitle.
  ///
  /// In es, this message translates to:
  /// **'Lo que recuerdo de vos'**
  String get memoryTitle;

  /// No description provided for @memoryPendingSectionTitle.
  ///
  /// In es, this message translates to:
  /// **'Para confirmar'**
  String get memoryPendingSectionTitle;

  /// No description provided for @memoryConfirmedSectionTitle.
  ///
  /// In es, this message translates to:
  /// **'Lo que recuerdo'**
  String get memoryConfirmedSectionTitle;

  /// No description provided for @memoryConfirmedEmpty.
  ///
  /// In es, this message translates to:
  /// **'Todavía no hay datos confirmados.'**
  String get memoryConfirmedEmpty;

  /// No description provided for @memoryConfirmFact.
  ///
  /// In es, this message translates to:
  /// **'Confirmar'**
  String get memoryConfirmFact;

  /// No description provided for @memoryDismissFact.
  ///
  /// In es, this message translates to:
  /// **'Descartar'**
  String get memoryDismissFact;

  /// No description provided for @memoryEditFactTitle.
  ///
  /// In es, this message translates to:
  /// **'Editar dato'**
  String get memoryEditFactTitle;

  /// No description provided for @memoryEditFactCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get memoryEditFactCancel;

  /// No description provided for @memoryEditFactSave.
  ///
  /// In es, this message translates to:
  /// **'Guardar'**
  String get memoryEditFactSave;

  /// No description provided for @memoryBriefSectionTitle.
  ///
  /// In es, this message translates to:
  /// **'Notas del tutor'**
  String get memoryBriefSectionTitle;

  /// No description provided for @memoryBriefExplanation.
  ///
  /// In es, this message translates to:
  /// **'El tutor lee esto antes de cada sesión para ajustar cómo te habla.'**
  String get memoryBriefExplanation;

  /// No description provided for @memoryBriefSaveButton.
  ///
  /// In es, this message translates to:
  /// **'Guardar'**
  String get memoryBriefSaveButton;

  /// No description provided for @memoryForgetAllButton.
  ///
  /// In es, this message translates to:
  /// **'Olvidar todo'**
  String get memoryForgetAllButton;

  /// No description provided for @memoryForgetAllConfirmTitle1.
  ///
  /// In es, this message translates to:
  /// **'¿Olvidar todo lo que recuerda el tutor de vos?'**
  String get memoryForgetAllConfirmTitle1;

  /// No description provided for @memoryForgetAllConfirmBody1.
  ///
  /// In es, this message translates to:
  /// **'Se van a borrar todos los datos confirmados y las notas del tutor.'**
  String get memoryForgetAllConfirmBody1;

  /// No description provided for @memoryForgetAllConfirmTitle2.
  ///
  /// In es, this message translates to:
  /// **'Esto no se puede deshacer'**
  String get memoryForgetAllConfirmTitle2;

  /// No description provided for @memoryForgetAllConfirmBody2.
  ///
  /// In es, this message translates to:
  /// **'Confirmá de nuevo para borrar toda tu memoria.'**
  String get memoryForgetAllConfirmBody2;

  /// No description provided for @memoryForgetAllCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get memoryForgetAllCancel;

  /// No description provided for @memoryForgetAllConfirm.
  ///
  /// In es, this message translates to:
  /// **'Sí, olvidar todo'**
  String get memoryForgetAllConfirm;

  /// No description provided for @groupTitle.
  ///
  /// In es, this message translates to:
  /// **'Grupo'**
  String get groupTitle;

  /// No description provided for @groupLeaderboardTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu grupo esta semana'**
  String get groupLeaderboardTitle;

  /// No description provided for @groupStreak.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, one{1 día en racha grupal} other{{count} días en racha grupal}}'**
  String groupStreak(int count);

  /// No description provided for @groupChallengesTitle.
  ///
  /// In es, this message translates to:
  /// **'Desafíos'**
  String get groupChallengesTitle;

  /// No description provided for @groupChallengeText.
  ///
  /// In es, this message translates to:
  /// **'{name} practicó sobre {topic}, ¿te animás?'**
  String groupChallengeText(String name, String topic);

  /// No description provided for @groupChallengeAccept.
  ///
  /// In es, this message translates to:
  /// **'Aceptar'**
  String get groupChallengeAccept;

  /// No description provided for @groupWeeklySummaryTitle.
  ///
  /// In es, this message translates to:
  /// **'Resumen semanal'**
  String get groupWeeklySummaryTitle;

  /// No description provided for @groupShareButton.
  ///
  /// In es, this message translates to:
  /// **'Compartir'**
  String get groupShareButton;

  /// No description provided for @progressTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu progreso'**
  String get progressTitle;

  /// No description provided for @progressXpLabel.
  ///
  /// In es, this message translates to:
  /// **'XP'**
  String get progressXpLabel;

  /// No description provided for @progressStreakLabel.
  ///
  /// In es, this message translates to:
  /// **'Racha'**
  String get progressStreakLabel;

  /// No description provided for @progressLongestStreakLabel.
  ///
  /// In es, this message translates to:
  /// **'Racha más larga'**
  String get progressLongestStreakLabel;

  /// No description provided for @progressSessionsThisWeekLabel.
  ///
  /// In es, this message translates to:
  /// **'Sesiones esta semana'**
  String get progressSessionsThisWeekLabel;

  /// No description provided for @progressCorrectionsTrendTitle.
  ///
  /// In es, this message translates to:
  /// **'Tendencia de correcciones'**
  String get progressCorrectionsTrendTitle;

  /// No description provided for @progressCorrectionsTrendEmpty.
  ///
  /// In es, this message translates to:
  /// **'Todavía no hay suficientes datos.'**
  String get progressCorrectionsTrendEmpty;

  /// No description provided for @progressCorrectionsTrendCounts.
  ///
  /// In es, this message translates to:
  /// **'{count7d} en 7 días · {count30d} en 30 días'**
  String progressCorrectionsTrendCounts(int count7d, int count30d);

  /// No description provided for @settingsTitle.
  ///
  /// In es, this message translates to:
  /// **'Ajustes'**
  String get settingsTitle;

  /// No description provided for @settingsLanguageTitle.
  ///
  /// In es, this message translates to:
  /// **'Idioma'**
  String get settingsLanguageTitle;

  /// No description provided for @settingsLanguageSystem.
  ///
  /// In es, this message translates to:
  /// **'Detectar del sistema'**
  String get settingsLanguageSystem;

  /// No description provided for @settingsLanguageSpanish.
  ///
  /// In es, this message translates to:
  /// **'Español'**
  String get settingsLanguageSpanish;

  /// No description provided for @settingsLanguagePortuguese.
  ///
  /// In es, this message translates to:
  /// **'Português (Brasil)'**
  String get settingsLanguagePortuguese;

  /// No description provided for @settingsRemindersTitle.
  ///
  /// In es, this message translates to:
  /// **'Recordatorios'**
  String get settingsRemindersTitle;

  /// No description provided for @settingsMorningReminder.
  ///
  /// In es, this message translates to:
  /// **'Sesión de la mañana'**
  String get settingsMorningReminder;

  /// No description provided for @settingsEveningReminder.
  ///
  /// In es, this message translates to:
  /// **'Sesión de la noche'**
  String get settingsEveningReminder;

  /// No description provided for @settingsStreakAlert.
  ///
  /// In es, this message translates to:
  /// **'Alerta de racha en riesgo'**
  String get settingsStreakAlert;

  /// No description provided for @settingsSoundEffects.
  ///
  /// In es, this message translates to:
  /// **'Efectos de sonido'**
  String get settingsSoundEffects;

  /// No description provided for @settingsLogout.
  ///
  /// In es, this message translates to:
  /// **'Cerrar sesión'**
  String get settingsLogout;

  /// No description provided for @settingsDeleteAccount.
  ///
  /// In es, this message translates to:
  /// **'Borrar cuenta'**
  String get settingsDeleteAccount;

  /// No description provided for @settingsDeleteAccountConfirmTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Borrar tu cuenta?'**
  String get settingsDeleteAccountConfirmTitle;

  /// No description provided for @settingsDeleteAccountConfirmBody.
  ///
  /// In es, this message translates to:
  /// **'Se borran tus sesiones, datos y preferencias. No se puede deshacer.'**
  String get settingsDeleteAccountConfirmBody;

  /// No description provided for @settingsDeleteAccountCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get settingsDeleteAccountCancel;

  /// No description provided for @settingsDeleteAccountConfirm.
  ///
  /// In es, this message translates to:
  /// **'Borrar cuenta'**
  String get settingsDeleteAccountConfirm;

  /// No description provided for @authOfflineTitle.
  ///
  /// In es, this message translates to:
  /// **'No pudimos conectar'**
  String get authOfflineTitle;

  /// No description provided for @authOfflineBody.
  ///
  /// In es, this message translates to:
  /// **'Revisá tu conexión a internet y probá de nuevo. Tu sesión sigue guardada.'**
  String get authOfflineBody;

  /// No description provided for @authRetry.
  ///
  /// In es, this message translates to:
  /// **'Reintentar'**
  String get authRetry;

  /// No description provided for @summaryTooShortTitle.
  ///
  /// In es, this message translates to:
  /// **'Sesión corta'**
  String get summaryTooShortTitle;

  /// No description provided for @summaryTooShortBody.
  ///
  /// In es, this message translates to:
  /// **'Con 3 minutos y 2 respuestas ya cuenta. ¿Otra ahora?'**
  String get summaryTooShortBody;

  /// No description provided for @summaryTooShortRetryButton.
  ///
  /// In es, this message translates to:
  /// **'Practicar de nuevo'**
  String get summaryTooShortRetryButton;

  /// No description provided for @summaryFirstValidSessionBanner.
  ///
  /// In es, this message translates to:
  /// **'Primera sesión hecha. El tutor ya está tomando notas para la próxima.'**
  String get summaryFirstValidSessionBanner;

  /// No description provided for @settingsInvitationTitle.
  ///
  /// In es, this message translates to:
  /// **'Código de invitación'**
  String get settingsInvitationTitle;

  /// No description provided for @settingsInvitationHint.
  ///
  /// In es, this message translates to:
  /// **'Ingresá el código de tu grupo'**
  String get settingsInvitationHint;

  /// No description provided for @settingsInvitationSubmit.
  ///
  /// In es, this message translates to:
  /// **'Unirme al grupo'**
  String get settingsInvitationSubmit;

  /// No description provided for @settingsInvitationSuccess.
  ///
  /// In es, this message translates to:
  /// **'¡Listo! Ya sos parte del grupo.'**
  String get settingsInvitationSuccess;

  /// No description provided for @commonUndo.
  ///
  /// In es, this message translates to:
  /// **'Deshacer'**
  String get commonUndo;

  /// No description provided for @memoryFactDeleted.
  ///
  /// In es, this message translates to:
  /// **'Dato borrado.'**
  String get memoryFactDeleted;

  /// No description provided for @commonXpAmount.
  ///
  /// In es, this message translates to:
  /// **'{amount} XP'**
  String commonXpAmount(int amount);

  /// No description provided for @commonEmptyValue.
  ///
  /// In es, this message translates to:
  /// **'—'**
  String get commonEmptyValue;

  /// No description provided for @summaryXpDelta.
  ///
  /// In es, this message translates to:
  /// **'+{amount}'**
  String summaryXpDelta(int amount);

  /// No description provided for @correctionCategoryPastSimple.
  ///
  /// In es, this message translates to:
  /// **'Pasado simple'**
  String get correctionCategoryPastSimple;

  /// No description provided for @correctionCategoryPresentPerfect.
  ///
  /// In es, this message translates to:
  /// **'Presente perfecto'**
  String get correctionCategoryPresentPerfect;

  /// No description provided for @correctionCategoryArticles.
  ///
  /// In es, this message translates to:
  /// **'Artículos'**
  String get correctionCategoryArticles;

  /// No description provided for @correctionCategoryPrepositions.
  ///
  /// In es, this message translates to:
  /// **'Preposiciones'**
  String get correctionCategoryPrepositions;

  /// No description provided for @correctionCategoryWordOrder.
  ///
  /// In es, this message translates to:
  /// **'Orden de las palabras'**
  String get correctionCategoryWordOrder;

  /// No description provided for @correctionCategorySubjectVerb.
  ///
  /// In es, this message translates to:
  /// **'Concordancia sujeto-verbo'**
  String get correctionCategorySubjectVerb;

  /// No description provided for @correctionCategoryPlurals.
  ///
  /// In es, this message translates to:
  /// **'Plurales'**
  String get correctionCategoryPlurals;

  /// No description provided for @correctionCategoryVocabulary.
  ///
  /// In es, this message translates to:
  /// **'Vocabulario'**
  String get correctionCategoryVocabulary;

  /// No description provided for @correctionCategoryPronunciationHint.
  ///
  /// In es, this message translates to:
  /// **'Pronunciación'**
  String get correctionCategoryPronunciationHint;

  /// No description provided for @correctionCategoryFalseFriend.
  ///
  /// In es, this message translates to:
  /// **'Falso amigo'**
  String get correctionCategoryFalseFriend;

  /// No description provided for @correctionCategoryPhrasalVerb.
  ///
  /// In es, this message translates to:
  /// **'Verbo frasal'**
  String get correctionCategoryPhrasalVerb;

  /// No description provided for @correctionCategoryConditional.
  ///
  /// In es, this message translates to:
  /// **'Condicional'**
  String get correctionCategoryConditional;

  /// No description provided for @correctionCategoryModal.
  ///
  /// In es, this message translates to:
  /// **'Verbo modal'**
  String get correctionCategoryModal;

  /// No description provided for @correctionCategoryOther.
  ///
  /// In es, this message translates to:
  /// **'Otro'**
  String get correctionCategoryOther;

  /// No description provided for @summaryLevelUpBanner.
  ///
  /// In es, this message translates to:
  /// **'¡Subiste de nivel! Ahora sos {level}.'**
  String summaryLevelUpBanner(String level);

  /// No description provided for @summaryShareStreakButton.
  ///
  /// In es, this message translates to:
  /// **'Compartir tu racha'**
  String get summaryShareStreakButton;

  /// No description provided for @commonComingSoon.
  ///
  /// In es, this message translates to:
  /// **'Pronto'**
  String get commonComingSoon;

  /// No description provided for @settingsReminderNotificationTitle.
  ///
  /// In es, this message translates to:
  /// **'Open Fluent'**
  String get settingsReminderNotificationTitle;

  /// No description provided for @settingsReminderNotificationBody.
  ///
  /// In es, this message translates to:
  /// **'Es hora de tu práctica de inglés de 10 minutos.'**
  String get settingsReminderNotificationBody;

  /// No description provided for @onboardingStepIndicator.
  ///
  /// In es, this message translates to:
  /// **'Paso {step} de {total}'**
  String onboardingStepIndicator(int step, int total);

  /// No description provided for @onboardingXpAwarded.
  ///
  /// In es, this message translates to:
  /// **'¡Perfil completo! +{amount} XP'**
  String onboardingXpAwarded(int amount);

  /// No description provided for @homeChecklistTitle.
  ///
  /// In es, this message translates to:
  /// **'Para arrancar'**
  String get homeChecklistTitle;

  /// No description provided for @homeChecklistProfile.
  ///
  /// In es, this message translates to:
  /// **'Perfil listo'**
  String get homeChecklistProfile;

  /// No description provided for @homeChecklistProvider.
  ///
  /// In es, this message translates to:
  /// **'Conectar tu cuenta de IA'**
  String get homeChecklistProvider;

  /// No description provided for @homeChecklistFirstSession.
  ///
  /// In es, this message translates to:
  /// **'Primera sesión de 3 min'**
  String get homeChecklistFirstSession;

  /// No description provided for @homeCourtesyPracticeButton.
  ///
  /// In es, this message translates to:
  /// **'Probar una sesión gratis'**
  String get homeCourtesyPracticeButton;

  /// No description provided for @summaryCourtesyBanner.
  ///
  /// In es, this message translates to:
  /// **'Esa fue tu sesión de cortesía. Conectar tu cuenta de IA te lleva 2 minutos y es gratis.'**
  String get summaryCourtesyBanner;

  /// No description provided for @summaryCourtesyConnectButton.
  ///
  /// In es, this message translates to:
  /// **'Conectar mi cuenta'**
  String get summaryCourtesyConnectButton;

  /// No description provided for @firstSessionReminderDialogTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Te aviso mañana a esta misma hora?'**
  String get firstSessionReminderDialogTitle;

  /// No description provided for @firstSessionReminderDialogBody.
  ///
  /// In es, this message translates to:
  /// **'3 minutos alcanzan para mantener la racha.'**
  String get firstSessionReminderDialogBody;

  /// No description provided for @firstSessionReminderAccept.
  ///
  /// In es, this message translates to:
  /// **'Sí, avisame'**
  String get firstSessionReminderAccept;

  /// No description provided for @firstSessionReminderDecline.
  ///
  /// In es, this message translates to:
  /// **'Ahora no'**
  String get firstSessionReminderDecline;

  /// No description provided for @streakDangerBody.
  ///
  /// In es, this message translates to:
  /// **'{days, plural, one{Tu racha de 1 día vence a medianoche. 3 minutos alcanzan.} other{Tu racha de {days} días vence a medianoche. 3 minutos alcanzan.}}'**
  String streakDangerBody(int days);

  /// No description provided for @streakDangerGraceBody.
  ///
  /// In es, this message translates to:
  /// **'Hoy te salva el día de gracia; mañana no.'**
  String get streakDangerGraceBody;

  /// No description provided for @groupInviteFriendButton.
  ///
  /// In es, this message translates to:
  /// **'Invitar a un amigo'**
  String get groupInviteFriendButton;

  /// No description provided for @groupInviteMessage.
  ///
  /// In es, this message translates to:
  /// **'Te invito a mi grupo de inglés en Open Fluent. Código: {code}. 10 minutos por día, con tu cuenta gratis de IA.'**
  String groupInviteMessage(String code);

  /// No description provided for @errorInvitationLimitReached.
  ///
  /// In es, this message translates to:
  /// **'Ya tenés 5 invitaciones sin usar. Esperá a que alguien se sume para crear otra.'**
  String get errorInvitationLimitReached;

  /// No description provided for @errorGroupRequired.
  ///
  /// In es, this message translates to:
  /// **'Unite a un grupo con tu código de invitación para practicar.'**
  String get errorGroupRequired;

  /// No description provided for @authContinueWithGoogle.
  ///
  /// In es, this message translates to:
  /// **'Continuar con Google'**
  String get authContinueWithGoogle;

  /// No description provided for @authContinueWithApple.
  ///
  /// In es, this message translates to:
  /// **'Continuar con Apple'**
  String get authContinueWithApple;

  /// No description provided for @authSignInError.
  ///
  /// In es, this message translates to:
  /// **'No pudimos iniciar sesión. Probá de nuevo.'**
  String get authSignInError;

  /// No description provided for @summaryTitleNoCorrections.
  ///
  /// In es, this message translates to:
  /// **'Sesión sin correcciones'**
  String get summaryTitleNoCorrections;

  /// No description provided for @memoryBriefSaved.
  ///
  /// In es, this message translates to:
  /// **'Notas guardadas.'**
  String get memoryBriefSaved;

  /// No description provided for @conversationSlowerToggle.
  ///
  /// In es, this message translates to:
  /// **'Más lento'**
  String get conversationSlowerToggle;

  /// No description provided for @summaryCorrectedLabel.
  ///
  /// In es, this message translates to:
  /// **'Corregidas'**
  String get summaryCorrectedLabel;

  /// No description provided for @badgeLevelNewcomerName.
  ///
  /// In es, this message translates to:
  /// **'Newcomer'**
  String get badgeLevelNewcomerName;

  /// No description provided for @badgeLevelNewcomerCondition.
  ///
  /// In es, this message translates to:
  /// **'Recién llegado: empezá a practicar'**
  String get badgeLevelNewcomerCondition;

  /// No description provided for @badgeLevelChatterboxName.
  ///
  /// In es, this message translates to:
  /// **'Chatterbox'**
  String get badgeLevelChatterboxName;

  /// No description provided for @badgeLevelChatterboxCondition.
  ///
  /// In es, this message translates to:
  /// **'Charlatán: sumá 500 XP'**
  String get badgeLevelChatterboxCondition;

  /// No description provided for @badgeLevelStorytellerName.
  ///
  /// In es, this message translates to:
  /// **'Storyteller'**
  String get badgeLevelStorytellerName;

  /// No description provided for @badgeLevelStorytellerCondition.
  ///
  /// In es, this message translates to:
  /// **'Cuentacuentos: sumá 1.500 XP'**
  String get badgeLevelStorytellerCondition;

  /// No description provided for @badgeLevelDebaterName.
  ///
  /// In es, this message translates to:
  /// **'Debater'**
  String get badgeLevelDebaterName;

  /// No description provided for @badgeLevelDebaterCondition.
  ///
  /// In es, this message translates to:
  /// **'Polemista: sumá 3.500 XP'**
  String get badgeLevelDebaterCondition;

  /// No description provided for @badgeLevelNativeIshName.
  ///
  /// In es, this message translates to:
  /// **'Native-ish'**
  String get badgeLevelNativeIshName;

  /// No description provided for @badgeLevelNativeIshCondition.
  ///
  /// In es, this message translates to:
  /// **'Casi nativo: sumá 7.000 XP'**
  String get badgeLevelNativeIshCondition;

  /// No description provided for @badgeStreak3Name.
  ///
  /// In es, this message translates to:
  /// **'Racha de 3 días'**
  String get badgeStreak3Name;

  /// No description provided for @badgeStreak3Condition.
  ///
  /// In es, this message translates to:
  /// **'Practicá 3 días seguidos'**
  String get badgeStreak3Condition;

  /// No description provided for @badgeStreak7Name.
  ///
  /// In es, this message translates to:
  /// **'Racha de 7 días'**
  String get badgeStreak7Name;

  /// No description provided for @badgeStreak7Condition.
  ///
  /// In es, this message translates to:
  /// **'Practicá 7 días seguidos'**
  String get badgeStreak7Condition;

  /// No description provided for @badgeStreak30Name.
  ///
  /// In es, this message translates to:
  /// **'Racha de 30 días'**
  String get badgeStreak30Name;

  /// No description provided for @badgeStreak30Condition.
  ///
  /// In es, this message translates to:
  /// **'Practicá 30 días seguidos'**
  String get badgeStreak30Condition;

  /// No description provided for @badgeStreak100Name.
  ///
  /// In es, this message translates to:
  /// **'Racha de 100 días'**
  String get badgeStreak100Name;

  /// No description provided for @badgeStreak100Condition.
  ///
  /// In es, this message translates to:
  /// **'Practicá 100 días seguidos'**
  String get badgeStreak100Condition;

  /// No description provided for @badgeFirstSessionName.
  ///
  /// In es, this message translates to:
  /// **'Primera sesión'**
  String get badgeFirstSessionName;

  /// No description provided for @badgeFirstSessionCondition.
  ///
  /// In es, this message translates to:
  /// **'Completá tu primera sesión'**
  String get badgeFirstSessionCondition;

  /// No description provided for @badgeSessions10Name.
  ///
  /// In es, this message translates to:
  /// **'10 sesiones'**
  String get badgeSessions10Name;

  /// No description provided for @badgeSessions10Condition.
  ///
  /// In es, this message translates to:
  /// **'Completá 10 sesiones'**
  String get badgeSessions10Condition;

  /// No description provided for @badgeSessions50Name.
  ///
  /// In es, this message translates to:
  /// **'50 sesiones'**
  String get badgeSessions50Name;

  /// No description provided for @badgeSessions50Condition.
  ///
  /// In es, this message translates to:
  /// **'Completá 50 sesiones'**
  String get badgeSessions50Condition;

  /// No description provided for @badgeSessions100Name.
  ///
  /// In es, this message translates to:
  /// **'100 sesiones'**
  String get badgeSessions100Name;

  /// No description provided for @badgeSessions100Condition.
  ///
  /// In es, this message translates to:
  /// **'Completá 100 sesiones'**
  String get badgeSessions100Condition;

  /// No description provided for @badgeBossWonName.
  ///
  /// In es, this message translates to:
  /// **'Desafío superado'**
  String get badgeBossWonName;

  /// No description provided for @badgeBossWonCondition.
  ///
  /// In es, this message translates to:
  /// **'Completá una sesión desafío'**
  String get badgeBossWonCondition;

  /// No description provided for @badgeNoCorrectionsName.
  ///
  /// In es, this message translates to:
  /// **'Sin errores'**
  String get badgeNoCorrectionsName;

  /// No description provided for @badgeNoCorrectionsCondition.
  ///
  /// In es, this message translates to:
  /// **'Terminá una sesión sin correcciones'**
  String get badgeNoCorrectionsCondition;

  /// No description provided for @badgeDoubleDayName.
  ///
  /// In es, this message translates to:
  /// **'Día doble'**
  String get badgeDoubleDayName;

  /// No description provided for @badgeDoubleDayCondition.
  ///
  /// In es, this message translates to:
  /// **'Hacé las 2 sesiones del mismo día'**
  String get badgeDoubleDayCondition;

  /// No description provided for @badgesTitle.
  ///
  /// In es, this message translates to:
  /// **'Logros'**
  String get badgesTitle;

  /// No description provided for @badgesSeeAll.
  ///
  /// In es, this message translates to:
  /// **'Ver logros'**
  String get badgesSeeAll;

  /// No description provided for @badgesNewUnlocked.
  ///
  /// In es, this message translates to:
  /// **'Nueva insignia'**
  String get badgesNewUnlocked;

  /// No description provided for @badgesLocked.
  ///
  /// In es, this message translates to:
  /// **'Bloqueada'**
  String get badgesLocked;

  /// No description provided for @badgesEarnedOn.
  ///
  /// In es, this message translates to:
  /// **'Ganada el {date}'**
  String badgesEarnedOn(String date);

  /// No description provided for @badgesProgress.
  ///
  /// In es, this message translates to:
  /// **'{current} de {target}'**
  String badgesProgress(int current, int target);

  /// No description provided for @badgesEarnedCount.
  ///
  /// In es, this message translates to:
  /// **'{earned} de {total}'**
  String badgesEarnedCount(int earned, int total);

  /// No description provided for @badgesCategoryLevel.
  ///
  /// In es, this message translates to:
  /// **'Niveles'**
  String get badgesCategoryLevel;

  /// No description provided for @badgesCategoryStreak.
  ///
  /// In es, this message translates to:
  /// **'Rachas'**
  String get badgesCategoryStreak;

  /// No description provided for @badgesCategorySessions.
  ///
  /// In es, this message translates to:
  /// **'Sesiones'**
  String get badgesCategorySessions;

  /// No description provided for @badgesCategorySpecial.
  ///
  /// In es, this message translates to:
  /// **'Especiales'**
  String get badgesCategorySpecial;
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
