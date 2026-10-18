/**
 * Piezas comunes de los repositorios de los jobs de la cola `interviews`
 * (`interview-prepare` e `interview-feedback`): candado Redis por entrevista,
 * fila de `llm_calls` y la transición `feedback_pending` → `feedback_failed`.
 */
import type { InsForgeClient } from '@insforge/sdk';
import type { Redis } from 'ioredis';

import { TABLES } from '../../db/schema.js';
import { unwrapInsforge, type InsforgeResult } from '../../insforge/insforge-result.js';
import type { Purpose } from '../../llm/config.js';

type Database = InsForgeClient['database'];

/**
 * Toma el candado si está libre o si ya es de este mismo job (BullMQ vuelve a
 * ejecutar el mismo job id en un reintento).
 */
const ACQUIRE_LOCK_SCRIPT =
  "local v = redis.call('GET', KEYS[1]) if v == false or v == ARGV[1] then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end return 0";

/** Borra el candado solo si sigue siendo de este job. */
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

export async function acquireJobLock(
  redis: Redis,
  key: string,
  owner: string,
  ttlMs: number,
): Promise<boolean> {
  return (await redis.eval(ACQUIRE_LOCK_SCRIPT, 1, key, owner, ttlMs)) === 1;
}

export async function releaseJobLock(redis: Redis, key: string, owner: string): Promise<void> {
  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, owner);
  } catch {
    // Si no se puede soltar, caduca solo (TTL del candado).
  }
}

export interface RecordAgentUsageInput {
  readonly userId: string;
  readonly purpose: Purpose;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly attempt: number;
  readonly promptVersion: number;
}

/** Una fila `ok` de `llm_calls` por llamada al agente de entrevistas. */
export async function insertAgentLlmCall(db: Database, input: RecordAgentUsageInput): Promise<void> {
  const result = await db.from(TABLES.llmCalls).insert({
    user_id: input.userId,
    session_id: null,
    purpose: input.purpose,
    provider: '9router',
    model: input.model,
    tokens_in: input.tokensIn,
    tokens_out: input.tokensOut,
    latency_ms: input.latencyMs,
    status: 'ok',
    attempt: input.attempt,
    prompt_version: input.promptVersion,
  });
  unwrapInsforge(result as InsforgeResult<unknown>);
}

/**
 * `feedback_pending` → `feedback_failed`, solo desde `feedback_pending`. Única
 * transición que usan el job, el cierre de la sesión y `POST /interviews/:id/retry`.
 * Con `userId`, filtra también por dueño.
 */
export async function markInterviewFeedbackFailed(
  db: Database,
  interviewId: string,
  errorCode: string,
  userId?: string,
): Promise<void> {
  let query = db
    .from(TABLES.interviews)
    .update({ status: 'feedback_failed', error_code: errorCode })
    .eq('id', interviewId)
    .eq('status', 'feedback_pending');
  if (userId !== undefined) query = query.eq('user_id', userId);
  unwrapInsforge((await query) as InsforgeResult<unknown>);
}
