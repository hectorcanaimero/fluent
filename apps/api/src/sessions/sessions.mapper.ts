import type { CorrectionCategory, Session } from '../db/schema.js';
import type { CorrectionDto, SessionInfoDto } from './sessions.types.js';

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

/**
 * `turns.latency_ms` es un `int` en base: la latencia que da
 * `LlmServiceResult` (un `number` con decimales) se redondea y nunca es
 * negativa. La usan la apertura (T1) y cada turno (T2), por eso vive aquí y no
 * dentro de un servicio.
 */
export function roundLatency(latencyMs: number | null): number | null {
  return latencyMs === null ? null : Math.max(0, Math.round(latencyMs));
}

/**
 * Fila de `corrections` (o el objeto que devuelve el modelo) → `Correction` de
 * la app. `note` **no** es nullable en
 * `apps/mobile/lib/core/api/models.dart`, así que un `note` nulo en base se
 * mapea a `''` (decisión de la sesión líder).
 */
export function toCorrectionDto(row: {
  readonly original: string;
  readonly corrected: string;
  readonly category: CorrectionCategory;
  readonly note: string | null;
}): CorrectionDto {
  return {
    original: row.original,
    corrected: row.corrected,
    category: row.category,
    note: row.note ?? '',
  };
}
