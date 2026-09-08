/** Truncados del presupuesto de contexto (SPEC-03 §3 y §4.2). */
import {
  BRIEF_CHARS,
  HISTORY_TURNS,
  HISTORY_TURN_CHARS,
  TRANSCRIPT_CHARS,
  USER_MESSAGE_CHARS,
} from '../config.js';

export interface HistoryTurn {
  readonly role: 'user' | 'tutor';
  readonly text: string;
}

/** Recorta por la derecha sin dejar espacios sueltos al final. */
export function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  return text.length <= maxChars ? text : text.slice(0, maxChars).trimEnd();
}

/**
 * SPEC-03 §3: últimos `HISTORY_TURNS` turnos (4 intercambios), cada uno truncado a
 * `HISTORY_TURN_CHARS` caracteres. Mantiene el orden cronológico.
 */
export function truncateHistory(
  history: readonly HistoryTurn[],
  maxTurns: number = HISTORY_TURNS,
  maxChars: number = HISTORY_TURN_CHARS,
): HistoryTurn[] {
  const recent = maxTurns >= history.length ? history : history.slice(history.length - maxTurns);
  return recent.map((turn) => ({ role: turn.role, text: truncateText(turn.text, maxChars) }));
}

/** SPEC-03 §3: mensaje del usuario ≤ 1 000 caracteres. */
export function truncateUserMessage(text: string, maxChars: number = USER_MESSAGE_CHARS): string {
  return truncateText(text, maxChars);
}

/** SPEC-03 §3: brief ≤ 600 caracteres. */
export function truncateBrief(text: string, maxChars: number = BRIEF_CHARS): string {
  return truncateText(text, maxChars);
}

/**
 * SPEC-03 §4.2: el transcript se pasa truncado a los ÚLTIMOS `TRANSCRIPT_CHARS`
 * caracteres (interesa el final de la sesión, no el principio).
 */
export function truncateTranscript(
  transcript: string,
  maxChars: number = TRANSCRIPT_CHARS,
): string {
  if (maxChars <= 0) return '';
  if (transcript.length <= maxChars) return transcript;
  const tail = transcript.slice(transcript.length - maxChars);
  // No cortar a mitad de línea: se descarta la primera línea parcial si hay más.
  const newline = tail.indexOf('\n');
  return newline > 0 && newline < tail.length - 1 ? tail.slice(newline + 1) : tail.trimStart();
}

/** Formato `Learner: ...` / `Tutor: ...` de SPEC-03 §4.2. */
export function formatTranscript(turns: readonly HistoryTurn[]): string {
  return turns.map((t) => `${t.role === 'user' ? 'Learner' : 'Tutor'}: ${t.text}`).join('\n');
}
