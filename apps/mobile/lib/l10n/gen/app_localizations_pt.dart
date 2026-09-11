// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Fluent';

  @override
  String get splashLoading => 'Carregando…';

  @override
  String get tabHome => 'Início';

  @override
  String get tabPractice => 'Praticar';

  @override
  String get tabGroup => 'Grupo';

  @override
  String get tabProgress => 'Progresso';

  @override
  String get comingSoonTitle => 'Em breve';

  @override
  String get commonLoadErrorTitle => 'Não conseguimos carregar isso';

  @override
  String get commonLoadErrorBody => 'Verifique sua conexão e tente de novo.';

  @override
  String get commonRetry => 'Tentar de novo';

  @override
  String get errorGeneric => 'Ocorreu um erro. Tente de novo.';

  @override
  String get errorUnauthenticated => 'Sua sessão expirou. Entre de novo.';

  @override
  String get errorForbidden => 'Você não tem permissão para fazer isso.';

  @override
  String get errorNotOnboarded => 'Ainda falta completar seu perfil.';

  @override
  String get errorValidation => 'Revise os dados e tente de novo.';

  @override
  String get errorInvitationInvalid => 'Esse código de convite não é válido.';

  @override
  String get errorInvitationUsed => 'Esse código de convite já foi usado.';

  @override
  String get errorInvitationExpired => 'Esse código de convite expirou.';

  @override
  String get errorAlreadyInGroup => 'Você já está em um grupo.';

  @override
  String get errorProviderNotConnected =>
      'Conecte um provedor para poder praticar.';

  @override
  String get errorProviderKeyInvalid => 'Essa chave não é válida.';

  @override
  String get errorModelNotAvailable => 'Esse modelo não está disponível agora.';

  @override
  String get errorSessionNotActive => 'Essa sessão não está mais ativa.';

  @override
  String get errorSessionAlreadyActive => 'Você já tem uma sessão aberta.';

  @override
  String get errorLlmUnavailable =>
      'O tutor não está disponível agora. Tente de novo em instantes.';

  @override
  String get errorRateLimited =>
      'Você fez muitas solicitações seguidas. Espere um momento.';

  @override
  String get errorNotReady =>
      'Ainda não está pronto. Tente de novo em instantes.';

  @override
  String get errorNotFound => 'Não encontramos isso.';

  @override
  String get errorInternal =>
      'Tivemos um problema do nosso lado. Tente de novo.';

  @override
  String get errorChallengeNotAvailable =>
      'Esse desafio não está mais disponível.';

  @override
  String get errorTurnsDailyCap =>
      'Você atingiu o máximo de turnos hoje. Amanhã a gente continua.';

  @override
  String get formFieldRequired => 'Este campo é obrigatório.';

  @override
  String get loginWelcomeHeadline =>
      'Fale inglês com confiança, 10 minutos por vez';

  @override
  String get loginWelcomeSubtitle =>
      'Fluent é seu coach pessoal de conversação. Duas sessões curtas por dia, sobre temas que você realmente gosta.';

  @override
  String get loginBenefit1 => 'Conversas reais com um tutor de IA';

  @override
  String get loginBenefit2 => 'Fale sobre as notícias de hoje, do seu jeito';

  @override
  String get loginBenefit3 => 'Construa uma sequência que realmente se mantém';

  @override
  String get loginGetStartedButton => 'Criar conta';

  @override
  String get loginAlreadyHaveAccount => 'Já tem uma conta? Entrar';

  @override
  String get loginEmailLabel => 'Email';

  @override
  String get loginPasswordLabel => 'Senha';

  @override
  String get loginSubmitButton => 'Entrar';

  @override
  String get loginBackButton => 'Voltar';

  @override
  String get loginErrorInvalidCredentials => 'Email ou senha incorretos.';

  @override
  String get loginErrorGeneric => 'Não conseguimos entrar. Tente de novo.';

  @override
  String get registerTitle => 'Criar conta';

  @override
  String get registerNameLabel => 'Nome';

  @override
  String get registerEmailLabel => 'Email';

  @override
  String get registerPasswordLabel => 'Senha';

  @override
  String get registerInvitationCodeLabel => 'Código de convite';

  @override
  String get registerSubmitButton => 'Criar conta';

  @override
  String get registerGoToLogin => 'Já tem conta? Entrar';

  @override
  String get registerErrorGeneric =>
      'Não conseguimos criar a conta. Tente de novo.';

  @override
  String get registerErrorInvitationInvalid =>
      'Esse código de convite não é válido.';

  @override
  String get registerErrorInvitationUsed =>
      'Esse código de convite já foi usado.';

  @override
  String get registerErrorInvitationExpired =>
      'Esse código de convite expirou.';

  @override
  String get registerInvitationPendingTitle => 'Sua conta já foi criada';

  @override
  String get registerInvitationPendingBody =>
      'O código de convite ainda não funcionou. Tente de novo ou continue sem grupo por enquanto; você pode inserir o código mais tarde durante o onboarding.';

  @override
  String get registerInvitationRetryButton => 'Tentar código novamente';

  @override
  String get registerInvitationContinueButton =>
      'Continuar sem grupo por enquanto';

  @override
  String get onboardingContinueButton => 'Continuar';

  @override
  String get onboardingFinishButton => 'Concluir';

  @override
  String get onboardingErrorGeneric => 'Algo deu errado. Tente de novo.';

  @override
  String get onboardingNameHeadline => 'Como podemos te chamar?';

  @override
  String get onboardingNameSubtitle =>
      'É assim que seus colegas de grupo vão te ver.';

  @override
  String get onboardingNameLabel => 'Nome';

  @override
  String get onboardingLevelHeadline => 'Como está seu inglês agora?';

  @override
  String get onboardingLevelSubtitle =>
      'Sem pressão. Vamos ajustar aos poucos, isso só define seu ponto de partida.';

  @override
  String get onboardingLevelBeginnerTitle => 'Iniciante';

  @override
  String get onboardingLevelBeginnerSubtitle =>
      'Conheço algumas palavras e frases simples';

  @override
  String get onboardingLevelIntermediateTitle => 'Intermediário';

  @override
  String get onboardingLevelIntermediateSubtitle =>
      'Consigo manter uma conversa, mas cometo erros';

  @override
  String get onboardingLevelAdvancedTitle => 'Avançado';

  @override
  String get onboardingLevelAdvancedSubtitle =>
      'Sou fluente e quero refinar nuances';

  @override
  String get onboardingInterestsHeadline => 'Sobre o que você gosta de falar?';

  @override
  String get onboardingInterestsSubtitle =>
      'Escolha pelo menos 3. Vamos usar para escolher notícias e temas para suas sessões.';

  @override
  String onboardingInterestsSelectedCount(int count) {
    return '$count selecionados';
  }

  @override
  String get onboardingInterestsSeeMore => 'Ver mais';

  @override
  String get interestTechnology => 'Tecnologia';

  @override
  String get interestVideogames => 'Videojogos';

  @override
  String get interestMoviesSeries => 'Cinema e séries';

  @override
  String get interestMusic => 'Música';

  @override
  String get interestSports => 'Esportes';

  @override
  String get interestFootball => 'Futebol';

  @override
  String get interestTravel => 'Viagens';

  @override
  String get interestCooking => 'Comida e culinária';

  @override
  String get interestHealthFitness => 'Saúde e fitness';

  @override
  String get interestScience => 'Ciência';

  @override
  String get interestSpace => 'Espaço';

  @override
  String get interestBusinessEntrepreneurship => 'Negócios e empreendedorismo';

  @override
  String get interestPersonalFinance => 'Finanças pessoais';

  @override
  String get interestArtificialIntelligence => 'Inteligência artificial';

  @override
  String get interestCarsMotor => 'Carros e motor';

  @override
  String get interestFashion => 'Moda';

  @override
  String get interestPhotography => 'Fotografia';

  @override
  String get interestArtDesign => 'Arte e design';

  @override
  String get interestBooksLiterature => 'Livros e literatura';

  @override
  String get interestHistory => 'História';

  @override
  String get interestNatureAnimals => 'Natureza e animais';

  @override
  String get interestEnvironment => 'Meio ambiente';

  @override
  String get interestEducationCareer => 'Educação e carreira';

  @override
  String get interestFamilyRelationships => 'Vida familiar e relacionamentos';

  @override
  String get providersTitle => 'Provedores e modelos';

  @override
  String get providersGoPractice => 'Pronto, ir praticar';

  @override
  String get providersOpenRouterTitle => 'OpenRouter';

  @override
  String get providersGeminiTitle => 'Gemini';

  @override
  String get providersGeminiRecommendedBadge => 'Recomendado';

  @override
  String get providersStatusConnected => 'Conectado';

  @override
  String get providersStatusNotConnected => 'Não conectado';

  @override
  String get providersStatusError => 'Com erro';

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
      'Não conseguimos concluir a conexão. Tente de novo.';

  @override
  String get providersOauthError =>
      'Não conseguimos conectar com o OpenRouter. Tente de novo.';

  @override
  String get providersLoadError => 'Não conseguimos carregar os provedores.';

  @override
  String get providersGeminiPasteKeyButton => 'Colar API key';

  @override
  String get providersGeminiKeyDialogTitle => 'Conectar Gemini';

  @override
  String get providersGeminiKeyLabel => 'API key do Gemini';

  @override
  String get providersGeminiKeyHelpStep1 => '1. Acesse';

  @override
  String get providersGeminiKeyHelpStep2 => '2. Crie uma nova API key';

  @override
  String get providersGeminiKeyHelpStep3 => '3. Copie e cole aqui';

  @override
  String get providersGeminiKeyLink => 'aistudio.google.com/apikey';

  @override
  String get providersGeminiKeyInvalid => 'Essa API key não é válida.';

  @override
  String get providersGeminiKeyCancel => 'Cancelar';

  @override
  String get providersGeminiKeyConfirm => 'Conectar';

  @override
  String get providersModelChatTitle => 'Modelo para conversar';

  @override
  String get providersModelBriefTitle => 'Modelo para o coach';

  @override
  String get providersModelTierFree => 'Grátis';

  @override
  String get providersModelTierBudget => 'Econômico';

  @override
  String get providersModelTierPremium => 'Premium';

  @override
  String get providersModelEstimateFree => 'Grátis';

  @override
  String providersModelEstimatePaid(String amount) {
    return '≈ $amount USD por sessão';
  }

  @override
  String get providersModelProviderDisabledHint =>
      'Conecte esse provedor para usá-lo';

  @override
  String get homeNeedProviderHint => 'Conecte um provedor para poder praticar';

  @override
  String homeGreetingMorning(String name) {
    return 'Bom dia, $name';
  }

  @override
  String homeGreetingAfternoon(Object name) {
    return 'Boa tarde, $name';
  }

  @override
  String homeGreetingEvening(Object name) {
    return 'Boa noite, $name';
  }

  @override
  String homeStreakDays(int count) {
    return '$count dias de sequência';
  }

  @override
  String get homeGraceDayAvailable => 'Dia de folga disponível essa semana';

  @override
  String homeXpToNextLevel(int amount) {
    return '$amount XP para subir de nível';
  }

  @override
  String get homePracticeButton => 'Praticar 10 min';

  @override
  String get homeBossButton => 'Boss battle';

  @override
  String get homeBossSkip => 'Hoje não';

  @override
  String homeSessionsTodayStatus(int done) {
    return '$done de 2 sessões hoje';
  }

  @override
  String get homeGroupCardTitle => 'Seu grupo essa semana';

  @override
  String get homeGroupSeeAll => 'Ver tudo';

  @override
  String homeGroupYourPosition(int position) {
    return 'Sua posição: #$position';
  }

  @override
  String homePendingFactsCard(int count) {
    return 'Tenho $count coisas novas para lembrar sobre você, quer revisar?';
  }

  @override
  String get homeNoProviderBanner => 'Conecte um provedor para praticar';

  @override
  String get homeNoProviderAction => 'Conectar';

  @override
  String get homePendingActionWeeklySummaryCredential =>
      'O resumo semanal do grupo não pôde ser gerado: conecte um provedor para que continue funcionando.';

  @override
  String get homePendingActionAction => 'Revisar';

  @override
  String get homeQuickTopicsTitle => 'Temas rápidos';

  @override
  String get homeQuickTopicsSeeAll => 'Ver tudo';

  @override
  String get homeLoadError => 'Não conseguimos carregar seu início.';

  @override
  String get sessionNewTitle => 'Escolha um tema';

  @override
  String get sessionNewTabTopics => 'Temas';

  @override
  String get sessionNewTabRoleplay => 'Roleplay';

  @override
  String get sessionNewTabNews => 'Notícias';

  @override
  String get sessionNewSurpriseMe => 'Me surpreenda';

  @override
  String get sessionNewSurpriseMeHint =>
      'Deixe seu coach escolher com base no que você já praticou';

  @override
  String get sessionNewFreeTopicLabel => 'Ou escreva seu próprio tema';

  @override
  String get sessionNewFreeTopicSubmit => 'Começar';

  @override
  String get sessionNewTalkAboutButton => 'Falar sobre isso';

  @override
  String get sessionNewErrorGeneric =>
      'Não conseguimos começar a sessão. Tente de novo.';

  @override
  String get micPermissionTitle => 'Precisamos do seu microfone';

  @override
  String get micPermissionBody =>
      'O Fluent usa o microfone do celular para te ouvir durante a conversa. A transcrição é processada no seu aparelho e você revisa antes de enviar.';

  @override
  String get micPermissionContinue => 'Continuar';

  @override
  String get conversationEndButton => 'Terminar';

  @override
  String get conversationEndConfirmTitle => 'Terminar a sessão?';

  @override
  String get conversationEndConfirmBody =>
      'Você vai perder a resposta que ainda não enviou.';

  @override
  String get conversationEndConfirmCancel => 'Continuar praticando';

  @override
  String get conversationEndConfirmConfirm => 'Terminar';

  @override
  String get conversationTwoMinutesWarning => '2 minutos';

  @override
  String get conversationTapToSpeak =>
      'Toque no microfone e fale, vamos te escutar';

  @override
  String get conversationListeningHint => 'Escutando…';

  @override
  String get conversationEditableHint => 'Edite sua resposta antes de enviar';

  @override
  String get conversationSendButton => 'Enviar';

  @override
  String get conversationRetryButton => 'Repetir';

  @override
  String get conversationTextFieldHint => 'Ou escreva sua resposta…';

  @override
  String get conversationTextModeButton => 'Escrever';

  @override
  String get conversationVoiceModeButton => 'Falar';

  @override
  String conversationCorrectionChip(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count correções',
      one: '1 correção',
    );
    return '$_temp0';
  }

  @override
  String get conversationCorrectionOriginalLabel => 'Você disse';

  @override
  String get conversationCorrectionCorrectedLabel => 'Melhor assim';

  @override
  String get conversationDegradedChip => 'Usei um modelo alternativo';

  @override
  String get conversationUnavailableTitle => 'O tutor não está disponível';

  @override
  String get conversationUnavailableBody =>
      'Não conseguimos conectar com o modelo várias vezes seguidas. Quer terminar a sessão?';

  @override
  String get conversationUnavailableEnd => 'Terminar sessão';

  @override
  String get conversationUnavailableStay => 'Continuar esperando';

  @override
  String get conversationSendErrorGeneric =>
      'Não conseguimos enviar sua mensagem. Tente de novo.';

  @override
  String get conversationBootErrorBack => 'Voltar';

  @override
  String get conversationMicUnavailableTitle => 'Sem reconhecimento de voz';

  @override
  String get conversationMicUnavailableBody =>
      'Seu aparelho não tem reconhecimento de voz em inglês instalado. Você pode escrever no modo texto.';

  @override
  String get conversationMicUnavailableAccept => 'Entendido';

  @override
  String conversationSpeedButtonLabel(String rate) {
    return '${rate}x';
  }

  @override
  String get conversationReplayAudio => 'Repetir áudio';

  @override
  String get summaryTitle => 'Ótima sessão!';

  @override
  String get summaryXpEarnedLabel => 'XP ganho';

  @override
  String get summaryStreakLabel => 'Sequência';

  @override
  String get summaryDurationLabel => 'Duração';

  @override
  String get summaryCorrectionsTitle => 'Correções';

  @override
  String get summaryCorrectionsEmpty => 'Sem correções dessa vez, muito bem!';

  @override
  String get summaryNextIsBossBanner => 'A próxima sessão é um Boss battle';

  @override
  String get summaryDoubleDayBadge =>
      'Segunda sessão do dia! Bônus desbloqueado';

  @override
  String get summaryBackButton => 'Voltar';

  @override
  String get memoryTitle => 'O que eu lembro de você';

  @override
  String get memoryPendingSectionTitle => 'Para confirmar';

  @override
  String get memoryConfirmedSectionTitle => 'O que eu lembro';

  @override
  String get memoryConfirmedEmpty => 'Ainda não há fatos confirmados.';

  @override
  String get memoryConfirmFact => 'Confirmar';

  @override
  String get memoryDismissFact => 'Descartar';

  @override
  String get memoryEditFactTitle => 'Editar fato';

  @override
  String get memoryEditFactCancel => 'Cancelar';

  @override
  String get memoryEditFactSave => 'Salvar';

  @override
  String get memoryBriefSectionTitle => 'Notas do coach';

  @override
  String get memoryBriefExplanation =>
      'O tutor lê isso antes de cada sessão para ajustar como fala com você.';

  @override
  String get memoryBriefSaveButton => 'Salvar';

  @override
  String get memoryForgetAllButton => 'Esquecer tudo';

  @override
  String get memoryForgetAllConfirmTitle1 =>
      'Esquecer tudo o que o tutor lembra de você?';

  @override
  String get memoryForgetAllConfirmBody1 =>
      'Todos os fatos confirmados e as notas do coach serão apagados.';

  @override
  String get memoryForgetAllConfirmTitle2 => 'Isso não pode ser desfeito';

  @override
  String get memoryForgetAllConfirmBody2 =>
      'Confirme de novo para apagar toda a sua memória.';

  @override
  String get memoryForgetAllCancel => 'Cancelar';

  @override
  String get memoryForgetAllConfirm => 'Sim, esquecer tudo';

  @override
  String get groupTitle => 'Grupo';

  @override
  String get groupLeaderboardTitle => 'Seu grupo essa semana';

  @override
  String groupStreak(int count) {
    return '$count dias de sequência em grupo';
  }

  @override
  String get groupChallengesTitle => 'Desafios';

  @override
  String groupChallengeText(String name, String topic) {
    return '$name praticou sobre $topic, topa?';
  }

  @override
  String get groupChallengeAccept => 'Aceitar';

  @override
  String get groupWeeklySummaryTitle => 'Resumo semanal';

  @override
  String get groupShareButton => 'Compartilhar no WhatsApp';

  @override
  String get progressTitle => 'Seu progresso';

  @override
  String get progressXpLabel => 'XP';

  @override
  String get progressStreakLabel => 'Sequência';

  @override
  String get progressLongestStreakLabel => 'Maior sequência';

  @override
  String get progressSessionsThisWeekLabel => 'Sessões essa semana';

  @override
  String get progressCorrectionsTrendTitle => 'Tendência de correções';

  @override
  String get progressCorrectionsTrendEmpty => 'Ainda não há dados suficientes.';

  @override
  String progressCorrectionsTrendCounts(int count7d, int count30d) {
    return '$count7d em 7 dias · $count30d em 30 dias';
  }

  @override
  String get settingsTitle => 'Ajustes';

  @override
  String get settingsLanguageTitle => 'Idioma';

  @override
  String get settingsLanguageSystem => 'Detectar do sistema';

  @override
  String get settingsLanguageSpanish => 'Espanhol';

  @override
  String get settingsLanguagePortuguese => 'Português (Brasil)';

  @override
  String get settingsRemindersTitle => 'Lembretes';

  @override
  String get settingsMorningReminder => 'Sessão da manhã';

  @override
  String get settingsEveningReminder => 'Sessão da tarde';

  @override
  String get settingsStreakAlert => 'Alerta de sequência em risco';

  @override
  String get settingsSoundEffects => 'Efeitos sonoros';

  @override
  String get settingsLogout => 'Sair';

  @override
  String get settingsDeleteAccount => 'Apagar conta';

  @override
  String get settingsDeleteAccountConfirmTitle => 'Apagar sua conta?';

  @override
  String get settingsDeleteAccountConfirmBody =>
      'Suas sessões, fatos e preferências serão apagados. Isso não pode ser desfeito.';

  @override
  String get settingsDeleteAccountCancel => 'Cancelar';

  @override
  String get settingsDeleteAccountConfirm => 'Apagar conta';

  @override
  String get authOfflineTitle => 'Não conseguimos conectar';

  @override
  String get authOfflineBody =>
      'Verifique sua conexão com a internet e tente de novo. Sua sessão continua salva.';

  @override
  String get authRetry => 'Tentar de novo';
}
