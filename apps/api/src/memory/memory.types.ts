import type { FactStatus, Level } from '../db/schema.js';

/**
 * Elemento de `facts.pending[]` / `facts.confirmed[]` de `GET /memory`
 * (SPEC-02 §4.4). Nombres de campo exactamente como los espera
 * `apps/mobile/lib/core/api/models.dart::MemoryFact` (no se toca ese
 * archivo): ojo, es **`sourceSession`**, no `sourceSessionId`.
 */
export interface MemoryFactDto {
  readonly id: string;
  readonly text: string;
  readonly status: FactStatus;
  readonly happensOn: string | null;
  readonly sourceSession: string | null;
  readonly lastUsedAt: string | null;
}

/** `facts` de `GET /memory`: solo `pending` y `confirmed` (SPEC-06 §4.5, PEND-45). */
export interface FactsBucketDto {
  readonly pending: MemoryFactDto[];
  readonly confirmed: MemoryFactDto[];
}

/**
 * Elemento de `brief.recurringErrors[]`. `example` nunca es `null`/`undefined`
 * en la respuesta: `apps/mobile/lib/core/api/models.dart::RecurringError` lo
 * declara `required String example` (no nullable) — ver PEND-46.
 */
export interface RecurringErrorDto {
  readonly category: string;
  readonly example: string;
}

/**
 * `brief` de `GET /memory` y respuesta de `PUT /memory/brief` (SPEC-02 §4.4).
 * Nunca `null`: `apps/mobile/lib/core/api/models.dart::MemoryResult.brief` no
 * es nullable (`required CoachingBrief brief`) — ver PEND-40.
 */
export interface CoachingBriefDto {
  readonly text: string;
  readonly levelHint: Level | null;
  readonly recurringErrors: RecurringErrorDto[];
  readonly updatedAt: string | null;
}

/** Respuesta completa de `GET /memory` (SPEC-02 §4.4). */
export interface MemoryResultDto {
  readonly facts: FactsBucketDto;
  readonly brief: CoachingBriefDto;
}
