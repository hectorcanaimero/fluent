import type { Session } from '../db/schema.js';
import type { SessionInfoDto } from './sessions.types.js';

/**
 * Fila de `sessions` (snake_case) → `SessionInfo` de la app (camelCase).
 *
 * `topic` y `xpEarned` nunca son nulos aquí: la columna `topic` es `NOT NULL`
 * y `xp_earned` tiene `DEFAULT 0 NOT NULL` en la migración 3, aunque en el
 * modelo de la app ambos sean opcionales. `endedAt` y `modelUsed` sí van como
 * `null` mientras la sesión siga abierta; la app los declara nullable.
 *
 * No expone `userId`, `turnsCount`, `callbackFactId` ni `briefJobStatus`: la
 * app no los conoce y `challenge_from_user_id`/`callback_fact_id` son datos
 * internos (SPEC-07 §9: en rutas de grupo solo se ven `topic` y `kind`).
 */
export function toSessionInfoDto(row: Session): SessionInfoDto {
  return {
    id: row.id,
    kind: row.kind,
    topic: row.topic,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    xpEarned: row.xp_earned,
    modelUsed: row.chat_model_used,
  };
}
