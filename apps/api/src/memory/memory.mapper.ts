import type { CoachingBrief, Fact, RecurringError } from '../db/schema.js';
import type { CoachingBriefDto, MemoryFactDto, RecurringErrorDto } from './memory.types.js';

/** Fila de `facts` (snake_case) → elemento de `facts.pending[]`/`facts.confirmed[]` (camelCase). */
export function toMemoryFactDto(row: Fact): MemoryFactDto {
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    happensOn: row.happens_on,
    sourceSession: row.source_session_id,
    lastUsedAt: row.last_used_at,
  };
}

/**
 * Brief por defecto cuando el usuario todavía no tiene fila en
 * `coaching_briefs` (PEND-40): la API nunca crea la fila hasta que el
 * usuario escribe una (`PUT /memory/brief`) o el job de PR-05 corre
 * `apply_brief`, pero el contrato de la app exige `brief` siempre presente.
 */
const EMPTY_BRIEF_DTO: CoachingBriefDto = {
  text: '',
  levelHint: null,
  recurringErrors: [],
  updatedAt: null,
};

/** Fila de `coaching_briefs` (o `null` si no existe) → `brief` de la API. */
export function toCoachingBriefDto(row: CoachingBrief | null): CoachingBriefDto {
  if (row === null) {
    return EMPTY_BRIEF_DTO;
  }
  return {
    text: row.text,
    levelHint: row.level_hint,
    recurringErrors: row.recurring_errors.map(toRecurringErrorDto),
    updatedAt: row.updated_at,
  };
}

/** `example` nunca falta en la respuesta (PEND-46): cadena vacía si la fila no lo trae. */
function toRecurringErrorDto(item: RecurringError): RecurringErrorDto {
  return { category: item.category, example: item.example ?? '' };
}
