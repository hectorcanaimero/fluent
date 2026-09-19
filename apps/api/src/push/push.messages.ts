import type { Locale } from '../db/schema.js';

export type PushKind = 'challenge' | 'weekly_summary';

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
