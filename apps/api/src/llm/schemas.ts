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

export const BriefOutput = z.object({
  brief: z.string().min(1).max(900),
  facts: z
    .array(
      z.object({
        text: z.string().max(200),
        happens_on: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      }),
    )
    .max(4)
    .default([]),
  level_hint: z.enum(['A2', 'B1', 'B2']).nullable().default(null),
  recurring_errors: z
    .array(
      z.object({
        category: z.enum(CATEGORIES).catch('other'),
        example: z.string().max(200),
      }),
    )
    .max(5)
    .default([]),
});

export type BriefOutput = z.infer<typeof BriefOutput>;

export const WeeklyOutput = z.object({
  text: z.string().min(50).max(1200),
});

export type WeeklyOutput = z.infer<typeof WeeklyOutput>;
