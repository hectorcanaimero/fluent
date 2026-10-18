import type { InsForgeClient } from '@insforge/sdk';

import { TABLES, type SessionKind } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';

/** Sesión activa que bloquea: la app la usa para saber a qué pantalla volver. */
export interface ActiveSessionRef {
  readonly id: string;
  readonly kind: SessionKind;
  /** Solo en `kind = 'interview'`: la app la retoma en `/interviews/:id/session`. */
  readonly interviewId: string | null;
}

/**
 * Sesión `active` del usuario que cuenta para «una sola sesión
 * activa» (SPEC-04 §2), la más reciente por `started_at`.
 *
 * Una entrevista en pausa (D5: el usuario terminó antes de tiempo, la
 * entrevista quedó `too_short` y su sesión sigue `active` para retomarla) no
 * cuenta: no bloquea las sesiones normales ni sale en `GET /me` como sesión
 * a retomar. Al retomarla vuelve a `in_progress` y sí cuenta.
 */
export async function findBlockingActiveSession(
  admin: InsForgeClient,
  userId: string,
): Promise<ActiveSessionRef | null> {
  const result = await admin.database
    .from(TABLES.sessions)
    .select('id, kind, interview_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false });
  const rows =
    unwrapInsforge<
      Array<{ id: string; kind: SessionKind; interview_id: string | null }>
    >(result) ?? [];

  const interviewIds = rows
    .filter((row) => row.kind === 'interview' && row.interview_id !== null)
    .map((row) => row.interview_id!);
  let paused = new Set<string>();
  if (interviewIds.length > 0) {
    const pausedResult = await admin.database
      .from(TABLES.interviews)
      .select('id')
      .in('id', interviewIds)
      .eq('status', 'too_short');
    paused = new Set(
      (unwrapInsforge<Array<{ id: string }>>(pausedResult) ?? []).map((r) => r.id),
    );
  }

  const row = rows.find(
    (r) => !(r.kind === 'interview' && r.interview_id !== null && paused.has(r.interview_id)),
  );
  return row ? { id: row.id, kind: row.kind, interviewId: row.interview_id } : null;
}
