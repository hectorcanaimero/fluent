import type { Locale } from '../db/schema.js';

export type PushKind =
  | 'challenge'
  | 'weekly_summary'
  | 'group_session'
  | 'group_message'
  | 'interview_ready'
  | 'interview_prep_failed'
  | 'interview_feedback_ready'
  | 'study_reminder';

export interface PushMessage {
  readonly title: string;
  readonly body: string;
  /** Datos para la app: qué pasó y a qué pantalla abrir al tocar. */
  readonly data: { readonly type: PushKind; readonly route: string };
}

export interface ChallengePushParams {
  readonly name: string;
  readonly topic: string;
}

/** Textos por idioma del destinatario (profiles.locale). */
export function challengeMessage(locale: Locale, p: ChallengePushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? `${p.name} praticou hoje` : `${p.name} practicó hoy`,
    body: pt
      ? `Falou sobre ${p.topic}. Topa o mesmo tema?`
      : `Habló de ${p.topic}. ¿Te animás con el mismo tema?`,
    data: { type: 'challenge', route: '/group' },
  };
}

export function weeklySummaryMessage(locale: Locale): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Resumo semanal do grupo' : 'Resumen semanal del grupo',
    body: pt
      ? 'O resumo da semana saiu. Veja como foi para todos.'
      : 'Ya salió el resumen de la semana. Mirá cómo les fue a todos.',
    data: { type: 'weekly_summary', route: '/group' },
  };
}

export interface GroupSessionPushParams {
  readonly sessionId: string;
  readonly initiatorName: string;
  readonly topic: string;
}

export function groupSessionMessage(locale: Locale, p: GroupSessionPushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Sessão em grupo' : 'Sesión grupal',
    body: pt
      ? `${p.initiatorName} abriu uma sessão em grupo sobre ${p.topic}`
      : `${p.initiatorName} abrió una sesión grupal sobre ${p.topic}`,
    data: { type: 'group_session', route: `/group-session/${p.sessionId}` },
  };
}

export interface InterviewReadyPushParams {
  readonly interviewId: string;
  readonly role: string;
  readonly company: string;
}

export function interviewReadyMessage(locale: Locale, p: InterviewReadyPushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Entrevista pronta' : 'Tu entrevista está lista',
    body: pt
      ? `Sua entrevista para ${p.role} na ${p.company} está pronta. Vamos começar?`
      : `Tu entrevista para ${p.role} en ${p.company} está lista. ¿Empezamos?`,
    data: { type: 'interview_ready', route: `/interviews/${p.interviewId}` },
  };
}

export interface InterviewPrepFailedPushParams {
  readonly interviewId: string;
  readonly company: string;
}

export function interviewPrepFailedMessage(locale: Locale, p: InterviewPrepFailedPushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Erro na preparação' : 'No pudimos preparar tu entrevista',
    body: pt
      ? `Não conseguimos preparar sua entrevista para ${p.company}. Toque para tentar novamente.`
      : `No pudimos preparar tu entrevista para ${p.company}. Toca para intentarlo de nuevo.`,
    data: { type: 'interview_prep_failed', route: `/interviews/${p.interviewId}` },
  };
}

export interface InterviewFeedbackReadyPushParams {
  readonly interviewId: string;
  readonly company: string;
}

export function interviewFeedbackReadyMessage(locale: Locale, p: InterviewFeedbackReadyPushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Parecer pronto' : 'Tu parecer está listo',
    body: pt
      ? `Seu parecer de ${p.company} está pronto.`
      : `Tu parecer de ${p.company} está listo.`,
    data: { type: 'interview_feedback_ready', route: `/interviews/${p.interviewId}/feedback` },
  };
}

export interface StudyReminderPushParams {
  readonly interviewId: string;
  readonly n: number;
  readonly total: number;
  readonly title: string;
}

export function studyReminderMessage(locale: Locale, p: StudyReminderPushParams): PushMessage {
  const pt = locale === 'pt-BR';
  return {
    title: pt ? 'Sessão de estudo' : 'Toca continuar',
    body: pt
      ? `Chegou a hora da sessão ${p.n} de ${p.total}: ${p.title}.`
      : `Te toca la sesión ${p.n} de ${p.total}: ${p.title}.`,
    data: { type: 'study_reminder', route: `/interviews/${p.interviewId}/cycle` },
  };
}
