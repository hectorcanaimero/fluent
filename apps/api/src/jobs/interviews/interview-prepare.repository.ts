/**
 * Acceso a datos del job `interview-prepare` (F10.3.T3).
 *
 * Deliberadamente estrecho: solo lo que necesita este job, no un repositorio
 * genérico de `interviews`. El módulo HTTP de entrevistas (F10.3.T2) tiene el
 * suyo propio; este no lo reusa porque ese task no es su dependencia.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import type { Redis } from 'ioredis';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { unwrapInsforge, type InsforgeResult } from '../../insforge/insforge-result.js';
import { REDIS_CACHE_CLIENT } from '../../redis/redis.constants.js';
import { TABLES } from '../../db/schema.js';
import type { Level } from '../../db/schema.js';
import type { Purpose } from '../../llm/config.js';
import { userDay } from '../../sessions/user-day.js';
import type {
  InterviewPlan,
  InterviewStatus,
  InterviewType,
  PrepStep,
  SeniorityLevel,
} from '../../interviews/interviews.types.js';

/** Últimas preguntas a considerar para `previousQuestions` (I1). */
export const PREVIOUS_QUESTIONS_LIMIT = 50;

/** DECR atómico que nunca baja de 0 ni crea la clave. */
const REFUND_SCRIPT =
  "local v = tonumber(redis.call('GET', KEYS[1]) or '0') if v > 0 then return redis.call('DECR', KEYS[1]) end return 0";

/**
 * Toma el candado si está libre o si ya es de este mismo job (BullMQ vuelve a
 * correr un job atascado con el mismo id: no debe bloquearse a sí mismo).
 */
const ACQUIRE_LOCK_SCRIPT =
  "local v = redis.call('GET', KEYS[1]) if v == false or v == ARGV[1] then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end return 0";

/** Borra el candado solo si sigue siendo de este job. */
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

/**
 * Vida del candado de preparación: el timeout del agente (120 s) más margen
 * para las lecturas/escrituras de alrededor. Si el worker muere, caduca solo.
 */
export const PREPARE_LOCK_TTL_MS = 180_000;

/**
 * Escapa un valor libre para un filtro `.or()` de PostgREST: entre comillas
 * dobles, con `"` y `\` escapados. Sin esto, un área como `Backend, APIs` o
 * `Data (ML)` rompe (o altera) el filtro, porque `,` y `()` son sintaxis.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/** El usuario no tiene fila en `profiles`: reintentar no lo arregla. */
export class ProfileMissingError extends Error {
  readonly name = 'ProfileMissingError';
}

/**
 * Nombres de las tablas de F10.1.T1. No viven en `db/schema.ts` porque esa
 * migración todavía no está reflejada ahí (fuera del alcance de F10.3.T3,
 * que no toca `db/schema.ts`): este job usa sus nombres literales en vez de
 * `TABLES.*`.
 */
const INTERVIEWS_TABLE = 'interviews';
const INTERVIEW_QUESTIONS_ASKED_TABLE = 'interview_questions_asked';

export interface InterviewPrepareRow {
  readonly id: string;
  readonly user_id: string;
  readonly parent_interview_id: string | null;
  readonly type: InterviewType;
  readonly offer_text: string | null;
  readonly offer_url: string | null;
  readonly offer_hash: string;
  readonly status: InterviewStatus;
  readonly created_at: string;
}

export interface InterviewCompany {
  readonly name: string;
  readonly industry?: string;
  readonly city?: string;
  readonly workMode?: string;
}

export interface MarkReadyInput {
  readonly company: InterviewCompany;
  readonly role: string;
  readonly area: string;
  readonly seniority: SeniorityLevel;
  readonly plan: InterviewPlan;
}

export interface RecordPrepareUsageInput {
  readonly userId: string;
  readonly purpose: Purpose;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly attempt: number;
  readonly promptVersion: number;
}

@Injectable()
export abstract class InterviewPrepareRepository {
  abstract loadInterview(interviewId: string): Promise<InterviewPrepareRow | null>;
  abstract loadLearnerLevel(userId: string): Promise<Level>;
  /** `previousQuestions` de I1: últimas N preguntas de la misma oferta o, en una re-entrevista, del área del padre. */
  abstract loadPreviousQuestions(
    interview: InterviewPrepareRow,
    limit: number,
  ): Promise<string[]>;
  /**
   * Candado `interview:prepare:{id}` mientras dura el job: dos jobs de la
   * misma entrevista (doble encolado, `retry` concurrente) no llaman los dos
   * al agente. Devuelve `false` si lo tiene otro job.
   */
  abstract acquirePrepareLock(interviewId: string, owner: string): Promise<boolean>;
  abstract releasePrepareLock(interviewId: string, owner: string): Promise<void>;
  abstract setPrepStep(interviewId: string, step: PrepStep): Promise<void>;
  abstract markReady(interviewId: string, input: MarkReadyInput): Promise<void>;
  abstract markPrepFailed(interviewId: string, errorCode: string): Promise<void>;
  /** Idempotente: omite las preguntas ya guardadas para `(userId, offerHash)`. */
  abstract insertQuestionsAsked(
    userId: string,
    offerHash: string,
    area: string,
    questions: readonly string[],
  ): Promise<void>;
  abstract recordPrepareUsage(input: RecordPrepareUsageInput): Promise<void>;
  /**
   * Devuelve el consumo del tope diario (F10.3.T2, contador Redis
   * `interviews:day:{userId}:{userDay}`): decrementa en 1 porque esta
   * preparación no llegó a dar una entrevista utilizable. Nunca lanza
   * (fail-open, igual que el resto de usos de Redis de este proyecto): con
   * Redis caído es peor no poder preparar nada que perder temporalmente un
   * reembolso de tope.
   *
   * `createdAt` es el de la entrevista: el cupo se consumió el día en que se
   * creó, no el día (quizá ya el siguiente) en que falló la preparación.
   */
  abstract refundDailyCap(userId: string, createdAt: string): Promise<void>;
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

@Injectable()
export class InsforgeInterviewPrepareRepository extends InterviewPrepareRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async loadInterview(interviewId: string): Promise<InterviewPrepareRow | null> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .select('id,user_id,parent_interview_id,type,offer_text,offer_url,offer_hash,status,created_at')
      .eq('id', interviewId)
      .maybeSingle();
    return unwrapInsforge(result as InsforgeResult<InterviewPrepareRow>);
  }

  async loadLearnerLevel(userId: string): Promise<Level> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('level')
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrapInsforge(result as InsforgeResult<{ level: Level }>);
    if (!row) {
      throw new ProfileMissingError(`El usuario ${userId} no tiene perfil`);
    }
    return row.level;
  }

  async loadPreviousQuestions(
    interview: InterviewPrepareRow,
    limit: number,
  ): Promise<string[]> {
    let area: string | null = null;
    if (interview.parent_interview_id) {
      const parent = await this.db
        .from(INTERVIEWS_TABLE)
        .select('area')
        .eq('id', interview.parent_interview_id)
        .maybeSingle();
      area = unwrapInsforge(parent as InsforgeResult<{ area: string | null }>)?.area ?? null;
    }

    const offerHash = quotePostgrestValue(interview.offer_hash);
    const filter = area
      ? `offer_hash.eq.${offerHash},area.eq.${quotePostgrestValue(area)}`
      : `offer_hash.eq.${offerHash}`;

    const result = await this.db
      .from(INTERVIEW_QUESTIONS_ASKED_TABLE)
      .select('question')
      .eq('user_id', interview.user_id)
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows =
      unwrapInsforge(result as InsforgeResult<{ question: string }[]>) ?? [];
    return rows.map((row) => row.question);
  }

  async acquirePrepareLock(interviewId: string, owner: string): Promise<boolean> {
    const acquired = await this.redis.eval(
      ACQUIRE_LOCK_SCRIPT,
      1,
      prepareLockKey(interviewId),
      owner,
      PREPARE_LOCK_TTL_MS,
    );
    return acquired === 1;
  }

  async releasePrepareLock(interviewId: string, owner: string): Promise<void> {
    try {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, prepareLockKey(interviewId), owner);
    } catch {
      // Si no se puede soltar, caduca solo (PREPARE_LOCK_TTL_MS).
    }
  }

  async setPrepStep(interviewId: string, step: PrepStep): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({ prep_step: step })
      .eq('id', interviewId);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async markReady(interviewId: string, input: MarkReadyInput): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({
        status: 'ready' satisfies InterviewStatus,
        prep_step: 'done' satisfies PrepStep,
        company: input.company,
        role: input.role,
        area: input.area,
        seniority: input.seniority,
        plan: input.plan,
      })
      .eq('id', interviewId)
      .eq('status', 'preparing' satisfies InterviewStatus);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async markPrepFailed(interviewId: string, errorCode: string): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({
        status: 'prep_failed' satisfies InterviewStatus,
        error_code: errorCode,
      })
      .eq('id', interviewId)
      .eq('status', 'preparing' satisfies InterviewStatus);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async insertQuestionsAsked(
    userId: string,
    offerHash: string,
    area: string,
    questions: readonly string[],
  ): Promise<void> {
    // La tabla no tiene `interview_id` (F10.1.T1): se deduplica por
    // `(user_id, offer_hash, question)` para que un reintento no las duplique.
    const existing = await this.db
      .from(INTERVIEW_QUESTIONS_ASKED_TABLE)
      .select('question')
      .eq('user_id', userId)
      .eq('offer_hash', offerHash)
      .in('question', [...questions]);
    const already = new Set(
      (unwrapInsforge(existing as InsforgeResult<{ question: string }[]>) ?? []).map((row) => row.question),
    );
    const rows = questions
      .filter((question) => !already.has(question))
      .map((question) => ({
        user_id: userId,
        offer_hash: offerHash,
        area,
        question,
      }));
    if (rows.length === 0) return;
    const result = await this.db.from(INTERVIEW_QUESTIONS_ASKED_TABLE).insert(rows);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async recordPrepareUsage(input: RecordPrepareUsageInput): Promise<void> {
    const result = await this.db.from(TABLES.llmCalls).insert({
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

  async refundDailyCap(userId: string, createdAt: string): Promise<void> {
    try {
      const profile = await this.db
        .from(TABLES.profiles)
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
      const timezone = unwrapInsforge(profile as InsforgeResult<{ timezone: string | null }>)?.timezone;
      const key = `interviews:day:${userId}:${userDay(timezone, new Date(createdAt))}`;
      // Solo si queda algo que devolver: un DECR sobre una clave expirada la
      // recrearía en -1 y sin TTL, regalando un cupo permanente.
      await this.redis.eval(REFUND_SCRIPT, 1, key);
    } catch {
      // Fail-open (ver el contrato de `refundDailyCap`): perder el reembolso
      // del tope es mejor que tumbar el job por un fallo de Redis o de lectura
      // del perfil.
    }
  }
}

function prepareLockKey(interviewId: string): string {
  return `interview:prepare:${interviewId}`;
}
