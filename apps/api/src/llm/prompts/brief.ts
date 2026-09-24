/**
 * Prompt de cierre de sesión: brief y hechos (SPEC-03 §4.2, RF-4.1).
 *
 * El system prompt es el literal de la spec, con `{native_language}` derivado de
 * `profiles.locale` igual que en el prompt de turno (§4.1).
 */
import { CATEGORIES } from '../schemas.js';
import type { Level, Locale, SessionKind } from '../config.js';
import type { LlmMessage } from '../types.js';
import { languageForLocale } from './languages.js';
import { formatTranscript, truncateTranscript, type HistoryTurn } from './truncate.js';

export interface BriefPromptInput {
  readonly locale: Locale;
  readonly level: Level;
  /** Notas de coaching anteriores, si las hay. */
  readonly previousBrief?: string | null;
  /** Hechos ya conocidos del usuario, para que el modelo no los repita. */
  readonly knownFacts?: readonly string[];
  readonly kind: SessionKind;
  readonly topic: string;
  /** Turnos de la sesión, en orden. */
  readonly turns: readonly HistoryTurn[];
}

export function buildBriefSystemPrompt(input: BriefPromptInput): string {
  return [
    `You are the coach behind an English tutor app. You will read one full conversation session of a ${languageForLocale(
      input.locale,
    )}-speaking learner (level ${input.level}) and the previous coaching notes.`,
    'Produce:',
    '- "brief": coaching notes for the tutor\'s next session, in English, imperative, max 600 characters. Merge with the previous notes; keep what is still true, drop what was fixed. Include: recurring grammar issues, vocabulary to reinforce, topics the learner enjoys, tone that works.',
    '- "facts": new personal facts the learner stated about their own life (job, hobbies, plans, people, dated events). Each: "text" in English, third person, max 160 characters; "happens_on" as YYYY-MM-DD only if the learner gave a clear date, else null. Do not repeat facts already known. Do not invent. If unsure, omit. Max 4.',
    '- "level_hint": your estimate of the learner\'s level: "A2", "B1" or "B2".',
    `- "recurring_errors": up to 5 {"category","example"} using categories: ${CATEGORIES.join(', ')}.`,
    'Respond with a single JSON object and nothing else.',
  ].join('\n');
}

export function buildBriefUserPrompt(input: BriefPromptInput): string {
  const previous = input.previousBrief?.trim() ? input.previousBrief.trim() : 'None';
  const facts =
    input.knownFacts && input.knownFacts.length > 0 ? input.knownFacts.join('; ') : 'None';
  const transcript = truncateTranscript(formatTranscript(input.turns));

  return [
    `Previous notes: ${previous}`,
    `Known facts: ${facts}`,
    `Session (${input.kind}: ${input.topic}):`,
    transcript,
  ].join('\n');
}

export function buildBriefMessages(input: BriefPromptInput): LlmMessage[] {
  return [
    { role: 'system', content: buildBriefSystemPrompt(input) },
    { role: 'user', content: buildBriefUserPrompt(input) },
  ];
}
