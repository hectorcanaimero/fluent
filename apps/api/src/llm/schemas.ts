import { z } from 'zod';

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
