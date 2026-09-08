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
}
