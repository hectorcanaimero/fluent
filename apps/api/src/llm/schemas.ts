import { z } from 'zod';

import { looksEnglish } from './english.js';

export const CATEGORIES = [
  'past_simple',
  'present_perfect',
  'articles',
  'prepositions',
  'word_order',
  'subject_verb',
  'plurals',
  'vocabulary',
  'pronunciation_hint',
  'false_friend',
  'phrasal_verb',
  'conditional',
  'modal',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const Correction = z.object({
  original: z.string().min(1).max(300),
  corrected: z.string().min(1).max(300),
  category: z.enum(CATEGORIES).catch('other'),
  note: z.string().max(140).default(''),
});

export type Correction = z.infer<typeof Correction>;

export const TurnOutput = z.object({
  reply: z.string().min(1).max(1200),
  corrections: z.array(Correction).max(2).default([]),
});

export type TurnOutput = z.infer<typeof TurnOutput>;

/**
 * Lista donde un elemento malo se tira solo: se queda con los que validan,
 * hasta `max`. Un dato con la fecha mal escrita no puede llevarse por delante
 * a los otros tres ni al brief entero.
 */
function keepValid<T extends z.ZodTypeAny>(item: T, max: number) {
  return z
    .array(z.unknown())
    .transform((raw) =>
      raw
        .map((entry) => item.safeParse(entry))
        .filter((result) => result.success)
        .map((result) => result.data as z.infer<T>)
        .slice(0, max),
    )
    .catch([])
    .default([]);
}

/**
 * El modelo a veces copia el id tal cual lo vio («#4», «4»): se acepta como
 * número si la cadena es solo eso; cualquier otra cosa sigue fallando.
 */
function numberFromId(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = /^#?(\d+)$/.exec(value.trim());
  return match ? Number(match[1]) : value;
}

const MessageId = z.preprocess(numberFromId, z.number().int().positive());

/** Corrección de grupo: apunta al mensaje corregido por su id (arch 002, Interfaces → LLM). */
export const GroupCorrection = Correction.extend({
  messageId: MessageId,
});

export type GroupCorrection = z.infer<typeof GroupCorrection>;

/**
 * Una corrección rota o una séptima no tiran el `reply`: se descartan solas
 * y la lista se recorta a 6, como en el brief.
 */
export const GroupTurnOutput = z.object({
  reply: z.string().min(1).max(1200),
  corrections: keepValid(GroupCorrection, 6),
});

export type GroupTurnOutput = z.infer<typeof GroupTurnOutput>;

/** Como `Correction`, pero una `note` larga se recorta en vez de tirar la corrección. */
const InterviewCorrection = Correction.extend({
  note: z
    .string()
    .transform((note) => note.slice(0, 140))
    .default(''),
});

/**
 * Turno de entrevista (arch 003, I3). Las correcciones no se dicen en voz
 * alta: van ocultas para la app y alimentan el parecer. Como en el grupo, una
 * corrección rota o una séptima no tiran el `reply`; un `reply` largo se
 * recorta y un `questionIdx` fuera de rango («#3», 0, 9) se lleva a 1..8.
 */
export const InterviewTurnOutput = z.object({
  // Fluent es para practicar inglés: un reply en otro idioma no es un turno
  // válido (ver `english.ts`), y LlmService prueba el siguiente candidato.
  reply: z
    .string()
    .min(1)
    .refine(looksEnglish, { message: 'reply must be in English' })
    .transform((reply) => reply.slice(0, 600)),
  questionIdx: z.preprocess(
    numberFromId,
    z
      .number()
      .int()
      .transform((idx) => Math.min(8, Math.max(1, idx))),
  ),
  isFollowUp: z.boolean().catch(false).default(false),
  done: z.boolean().catch(false).default(false),
  corrections: keepValid(InterviewCorrection, 6),
});

export type InterviewTurnOutput = z.infer<typeof InterviewTurnOutput>;

const BriefFact = z.object({
  text: z.string().transform((text) => text.slice(0, 200)),
  happens_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

const RecurringError = z.object({
  category: z.enum(CATEGORIES).catch('other'),
  example: z.string().transform((text) => text.slice(0, 200)),
});

/**
 * Lo accesorio no tumba lo importante: un brief de 901 caracteres, un quinto
 * dato o un `happens_on` que el modelo no escribió hacían fallar la
 * respuesta entera, y sin brief no se guarda ningún recuerdo. Los topes
 * recortan y las listas raras quedan vacías, igual que ya hacía `category`.
 */
export const BriefOutput = z.object({
  brief: z
    .string()
    .min(1)
    .transform((text) => text.slice(0, 900)),
  facts: keepValid(BriefFact, 4),
  level_hint: z.enum(['A2', 'B1', 'B2']).nullable().catch(null).default(null),
  recurring_errors: keepValid(RecurringError, 5),
});

export type BriefOutput = z.infer<typeof BriefOutput>;

export const WeeklyOutput = z.object({
  // Demasiado corto sí es un fallo real (el modelo no escribió el resumen);
  // pasarse de largo solo se recorta.
  text: z
    .string()
    .min(50)
    .transform((text) => text.slice(0, 1200)),
});

export type WeeklyOutput = z.infer<typeof WeeklyOutput>;
