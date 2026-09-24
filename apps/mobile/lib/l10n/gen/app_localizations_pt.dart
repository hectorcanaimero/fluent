// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Open Fluent';

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
  String get errorStreamTimeout =>
      'O tutor demorou para responder. Tente de novo.';

  @override
  String get formFieldRequired => 'Este campo é obrigatório.';

  @override
  String get welcomeSlide1Title => 'Um tutor que lembra de você';

  @override
  String get welcomeSlide1Body =>
      'Fale do seu trabalho, da sua viagem ou da sua entrevista. Ele corrige na hora, sem te interromper.';

  @override
  String get welcomeSlide2Title => 'Pratique com seus amigos';

  @override
  String get welcomeSlide2Body =>
      'Entre com o código de um amigo ou convide os seus. Cada sessão conta no ranking.';

  @override
  String get welcomeSlide3Title => '10 minutos, duas vezes por dia';

  @override
  String get welcomeSlide3Body =>
      'Uma sessão de manhã e outra à noite, com sua própria conta de IA grátis.';

  @override
  String get welcomeRankingYou => 'Você';

  @override
  String get welcomeSessionMorning => 'Manhã';

  @override
  String get welcomeSessionEvening => 'Noite';

  @override
  String welcomeStreakDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dias',
      one: '1 dia',
    );
    return '$_temp0';
  }

  @override
  String welcomePageLabel(int current, int total) {
    return 'Página $current de $total';
  }

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
  String get notFoundTitle => 'Essa tela não existe';

  @override
  String get notFoundBody => 'O link que você abriu não leva a lugar nenhum.';

  @override
  String get notFoundGoHome => 'Ir para o início';

  @override
  String get onboardingContinueButton => 'Continuar';

  @override
  String get onboardingFinishButton => 'Concluir';

  @override
  String get onboardingErrorGeneric => 'Algo deu errado. Tente de novo.';

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
      'Me viro bem e quero soar mais natural';

  @override
  String get onboardingInterestsHeadline => 'Sobre o que você gosta de falar?';

  @override
  String get onboardingInterestsSubtitle =>
      'Escolha pelo menos 3. Vamos usar para escolher notícias e temas para suas sessões.';

  @override
  String onboardingInterestsSelectedCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count selecionados',
      one: '1 selecionado',
    );
    return '$_temp0';
  }

  @override
  String get onboardingInterestsSeeMore => 'Ver mais';

  @override
  String get interestTechnology => 'Tecnologia';

  @override
  String get interestVideogames => 'Videogames';

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
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dias de sequência',
      one: '1 dia de sequência',
    );
    return '$_temp0';
  }

  @override
  String get streakGraceAvailable => 'Dia de folga disponível essa semana';

  @override
  String get streakGraceUsed =>
      'Folga já usada essa semana: hoje sem rede de proteção';

  @override
  String homeXpToNextLevel(int amount) {
    return '$amount XP para subir de nível';
  }

  @override
  String get homePracticeButton => 'Praticar 10 min';

  @override
  String get homeBossButton => 'Sessão desafio';

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
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Tenho $count coisas novas para lembrar sobre você, quer revisar?',
      one: 'Tenho 1 coisa nova para lembrar sobre você, quer revisar?',
    );
    return '$_temp0';
  }

  @override
  String get homePendingActionWeeklySummaryCredential =>
      'O resumo desta semana precisa da sua conta de IA. Conecte para ele continuar saindo.';

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
      'Deixe seu tutor escolher com base no que você já praticou';

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
      'O Open Fluent usa o microfone para te ouvir durante a conversa. Sua voz vira texto, nunca guardamos o áudio, e você revisa o texto antes de enviar.';

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
  String conversationListeningSecondsLeft(int seconds) {
    return '${seconds}s';
  }

  @override
  String get conversationThinkingHint => 'Pensando…';

  @override
  String get conversationSpeakingHint => 'Falando…';

  @override
  String get conversationStopButton => 'Parar';

  @override
  String get conversationMicButtonSemantics => 'Microfone, toque para falar';

  @override
  String get conversationMicButtonListeningSemantics =>
      'Escutando, toque para terminar';

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
  String get conversationDegradedChip => 'Resposta de reserva';

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
  String get conversationMicUnavailableBodyIos =>
      'O iPhone reconhece a voz com o Ditado. Ative em Ajustes → Geral → Teclado → Ativar Ditado e tente de novo. Enquanto isso, você pode escrever.';

  @override
  String get conversationMicUnavailableAccept => 'Entendido';

  @override
  String get conversationMicPermissionDeniedTitle => 'Ative o microfone';

  @override
  String get conversationMicPermissionDeniedBody =>
      'O Open Fluent precisa de permissão de microfone para te ouvir. Ative nas configurações do sistema.';

  @override
  String get conversationMicPermissionDeniedCancel => 'Cancelar';

  @override
  String get conversationMicPermissionDeniedOpenSettings =>
      'Abrir Configurações';

  @override
  String get conversationSttErrorNoMatch =>
      'Não entendemos o que você disse. Tente de novo.';

  @override
  String get conversationSttErrorTimeout =>
      'O tempo de escuta acabou. Tente de novo.';

  @override
  String get conversationSttErrorGeneric =>
      'Houve um problema com o microfone. Tente de novo.';

  @override
  String get conversationReplayAudio => 'Repetir áudio';

  @override
  String get summaryTitle => 'Sessão feita';

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
  String get summaryNextIsBossBanner => 'Sua próxima sessão é um desafio';

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
  String get memoryBriefSectionTitle => 'Notas do tutor';

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
      'Todos os fatos confirmados e as notas do tutor serão apagados.';

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
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dias de sequência em grupo',
      one: '1 dia de sequência em grupo',
    );
    return '$_temp0';
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
  String get groupShareButton => 'Compartilhar';

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
  String get settingsEveningReminder => 'Sessão da noite';

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

  @override
  String get summaryTooShortTitle => 'Sessão curta';

  @override
  String get summaryTooShortBody =>
      'Com 3 minutos e 2 respostas já conta. Outra agora?';

  @override
  String get summaryTooShortRetryButton => 'Praticar de novo';

  @override
  String get summaryFirstValidSessionBanner =>
      'Primeira sessão feita. O tutor já está anotando para a próxima.';

  @override
  String get settingsInvitationTitle => 'Código de convite';

  @override
  String get settingsInvitationHint => 'Digite o código do seu grupo';

  @override
  String get settingsInvitationSubmit => 'Entrar no grupo';

  @override
  String get settingsInvitationSuccess =>
      'Pronto! Agora você faz parte do grupo.';

  @override
  String get commonUndo => 'Desfazer';

  @override
  String get pushOpenAction => 'Ver';

  @override
  String get memoryFactDeleted => 'Fato apagado.';

  @override
  String commonXpAmount(int amount) {
    return '$amount XP';
  }

  @override
  String get commonEmptyValue => '—';

  @override
  String summaryXpDelta(int amount) {
    return '+$amount';
  }

  @override
  String get correctionCategoryPastSimple => 'Passado simples';

  @override
  String get correctionCategoryPresentPerfect => 'Presente perfeito';

  @override
  String get correctionCategoryArticles => 'Artigos';

  @override
  String get correctionCategoryPrepositions => 'Preposições';

  @override
  String get correctionCategoryWordOrder => 'Ordem das palavras';

  @override
  String get correctionCategorySubjectVerb => 'Concordância sujeito-verbo';

  @override
  String get correctionCategoryPlurals => 'Plurais';

  @override
  String get correctionCategoryVocabulary => 'Vocabulário';

  @override
  String get correctionCategoryPronunciationHint => 'Pronúncia';

  @override
  String get correctionCategoryFalseFriend => 'Falso cognato';

  @override
  String get correctionCategoryPhrasalVerb => 'Verbo frasal';

  @override
  String get correctionCategoryConditional => 'Condicional';

  @override
  String get correctionCategoryModal => 'Verbo modal';

  @override
  String get correctionCategoryOther => 'Outro';

  @override
  String summaryLevelUpBanner(String level) {
    return 'Você subiu de nível! Agora você é $level.';
  }

  @override
  String get summaryShareStreakButton => 'Compartilhar sua sequência';

  @override
  String get commonComingSoon => 'Em breve';

  @override
  String get settingsReminderNotificationTitle => 'Open Fluent';

  @override
  String get settingsReminderNotificationBody =>
      'Hora da sua prática de inglês de 10 minutos.';

  @override
  String onboardingStepIndicator(int step, int total) {
    return 'Passo $step de $total';
  }

  @override
  String onboardingXpAwarded(int amount) {
    return 'Perfil completo! +$amount XP';
  }

  @override
  String get homeChecklistTitle => 'Para começar';

  @override
  String get homeChecklistProfile => 'Perfil pronto';

  @override
  String get homeChecklistFirstSession => 'Primeira sessão de 3 min';

  @override
  String get homeCourtesyPracticeButton => 'Experimentar uma sessão grátis';

  @override
  String get summaryCourtesyBanner =>
      'Essa foi sua sessão de cortesia. Conectar sua conta de IA leva 2 minutos e é grátis.';

  @override
  String get summaryCourtesyConnectButton => 'Conectar minha conta';

  @override
  String get firstSessionReminderDialogTitle =>
      'Posso te avisar amanhã nesse mesmo horário?';

  @override
  String get firstSessionReminderDialogBody =>
      '3 minutos bastam pra manter sua sequência.';

  @override
  String get firstSessionReminderAccept => 'Sim, me avisa';

  @override
  String get firstSessionReminderDecline => 'Agora não';

  @override
  String streakDangerBody(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other:
          'Sua sequência de $days dias vence à meia-noite. 3 minutos bastam.',
      one: 'Sua sequência de 1 dia vence à meia-noite. 3 minutos bastam.',
    );
    return '$_temp0';
  }

  @override
  String get streakDangerGraceBody =>
      'Hoje o dia de folga te salva; amanhã não.';

  @override
  String get groupInviteFriendButton => 'Convidar um amigo';

  @override
  String groupInviteMessage(String code) {
    return 'Te convido pro meu grupo de inglês no Open Fluent. Código: $code. 10 minutos por dia, com sua conta grátis de IA.';
  }

  @override
  String get errorInvitationLimitReached =>
      'Você já tem 5 convites sem usar. Espere alguém entrar pra criar outro.';

  @override
  String get errorGroupRequired =>
      'Entre em um grupo com seu código de convite pra praticar.';

  @override
  String get authContinueWithGoogle => 'Continuar com Google';

  @override
  String get authContinueWithApple => 'Continuar com Apple';

  @override
  String get authSignInError => 'Não conseguimos entrar. Tente de novo.';

  @override
  String get summaryTitleNoCorrections => 'Sessão sem correções';

  @override
  String get memoryBriefSaved => 'Notas salvas.';

  @override
  String get conversationSlowerToggle => 'Mais devagar';

  @override
  String get summaryCorrectedLabel => 'Corrigidas';

  @override
  String get badgeLevelNewcomerName => 'Newcomer';

  @override
  String get badgeLevelNewcomerCondition => 'Recém-chegado: comece a praticar';

  @override
  String get badgeLevelChatterboxName => 'Chatterbox';

  @override
  String get badgeLevelChatterboxCondition => 'Tagarela: alcance 500 XP';

  @override
  String get badgeLevelStorytellerName => 'Storyteller';

  @override
  String get badgeLevelStorytellerCondition =>
      'Contador de histórias: alcance 1.500 XP';

  @override
  String get badgeLevelDebaterName => 'Debater';

  @override
  String get badgeLevelDebaterCondition => 'Debatedor: alcance 3.500 XP';

  @override
  String get badgeLevelNativeIshName => 'Native-ish';

  @override
  String get badgeLevelNativeIshCondition => 'Quase nativo: alcance 7.000 XP';

  @override
  String get badgeStreak3Name => 'Sequência de 3 dias';

  @override
  String get badgeStreak3Condition => 'Pratique 3 dias seguidos';

  @override
  String get badgeStreak7Name => 'Sequência de 7 dias';

  @override
  String get badgeStreak7Condition => 'Pratique 7 dias seguidos';

  @override
  String get badgeStreak30Name => 'Sequência de 30 dias';

  @override
  String get badgeStreak30Condition => 'Pratique 30 dias seguidos';

  @override
  String get badgeStreak100Name => 'Sequência de 100 dias';

  @override
  String get badgeStreak100Condition => 'Pratique 100 dias seguidos';

  @override
  String get badgeFirstSessionName => 'Primeira sessão';

  @override
  String get badgeFirstSessionCondition => 'Complete sua primeira sessão';

  @override
  String get badgeSessions10Name => '10 sessões';

  @override
  String get badgeSessions10Condition => 'Complete 10 sessões';

  @override
  String get badgeSessions50Name => '50 sessões';

  @override
  String get badgeSessions50Condition => 'Complete 50 sessões';

  @override
  String get badgeSessions100Name => '100 sessões';

  @override
  String get badgeSessions100Condition => 'Complete 100 sessões';

  @override
  String get badgeBossWonName => 'Desafio superado';

  @override
  String get badgeBossWonCondition => 'Complete uma sessão desafio';

  @override
  String get badgeNoCorrectionsName => 'Sem erros';

  @override
  String get badgeNoCorrectionsCondition => 'Termine uma sessão sem correções';

  @override
  String get badgeDoubleDayName => 'Dia duplo';

  @override
  String get badgeDoubleDayCondition => 'Faça as 2 sessões do mesmo dia';

  @override
  String get badgesTitle => 'Conquistas';

  @override
  String get badgesSeeAll => 'Ver conquistas';

  @override
  String get badgesNewUnlocked => 'Nova conquista';

  @override
  String get badgesLocked => 'Bloqueada';

  @override
  String badgesEarnedOn(String date) {
    return 'Conquistada em $date';
  }

  @override
  String badgesProgress(int current, int target) {
    return '$current de $target';
  }

  @override
  String badgesEarnedCount(int earned, int total) {
    return '$earned de $total';
  }

  @override
  String get badgesCategoryLevel => 'Níveis';

  @override
  String get badgesCategoryStreak => 'Sequências';

  @override
  String get badgesCategorySessions => 'Sessões';

  @override
  String get badgesCategorySpecial => 'Especiais';

  @override
  String get errorPlanRequired => 'Escolher um modelo pago requer o plano Pro.';

  @override
  String get settingsPlanTitle => 'Plano';

  @override
  String get settingsFreeModelsNote =>
      'Modelos gratuitos com reserva automática';

  @override
  String get planCurrentFree => 'Plano Free';

  @override
  String get planCurrentPro => 'Plano Pro';

  @override
  String planProUntil(String date) {
    return 'Vence em $date';
  }

  @override
  String get planProIncludesTitle => 'O que o Pro inclui';

  @override
  String get planProFeatureModels => 'Escolher modelos pagos para conversar';

  @override
  String get planProFeatureDailyCap => 'Até 120 turnos por dia';

  @override
  String get planProFeatureBrief => 'Notas do tutor com um modelo mais forte';

  @override
  String get planUpgradeButton => 'Assinar o Pro';

  @override
  String get planComingSoonTitle => 'Disponível em breve';

  @override
  String get planComingSoonBody =>
      'Estamos preparando o plano Pro. Avisaremos quando estiver pronto.';

  @override
  String get planComingSoonClose => 'Entendi';

  @override
  String get modelPickerChatTitle => 'Modelo para conversar';

  @override
  String get modelPickerBriefTitle => 'Modelo para as notas do tutor';

  @override
  String get modelPickerLoadError => 'Não conseguimos carregar os modelos.';

  @override
  String planUpgradeButtonWithPrice(String price) {
    return 'Assinar o Pro · $price';
  }

  @override
  String get planRestoreButton => 'Restaurar compras';

  @override
  String get planActivating => 'Será ativado em alguns minutos';

  @override
  String get planPurchaseError =>
      'Não conseguimos concluir a compra. Tente de novo.';
}
