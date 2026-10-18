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
  abstract setPrepStep(interviewId: string, step: PrepStep): Promise<void>;
  abstract markReady(interviewId: string, input: MarkReadyInput): Promise<void>;
  abstract markPrepFailed(interviewId: string, errorCode: string): Promise<void>;
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
   */
  abstract refundDailyCap(userId: string): Promise<void>;
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string } | null;
}

function unwrap<T>(result: PostgrestLike<T>, what: string): T | null {
  if (result.error) {
    throw new Error(
      `InsForge falló al ${what}: ${result.error.message ?? 'error desconocido'}`,
    );
  }
  return result.data;
}

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
      .select('id,user_id,parent_interview_id,type,offer_text,offer_url,offer_hash,status')
      .eq('id', interviewId)
      .maybeSingle();
    return unwrap(result as PostgrestLike<InterviewPrepareRow>, 'leer la entrevista');
  }

  async loadLearnerLevel(userId: string): Promise<Level> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('level')
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrap(result as PostgrestLike<{ level: Level }>, 'leer el nivel del perfil');
    if (!row) {
      throw new Error(`El usuario ${userId} no tiene perfil`);
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
      area = unwrap(parent as PostgrestLike<{ area: string | null }>, 'leer el área de la entrevista previa')?.area ?? null;
    }

    const filter = area
      ? `offer_hash.eq.${interview.offer_hash},area.eq.${area}`
      : `offer_hash.eq.${interview.offer_hash}`;

    const result = await this.db
      .from(INTERVIEW_QUESTIONS_ASKED_TABLE)
      .select('question')
      .eq('user_id', interview.user_id)
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows =
      unwrap(result as PostgrestLike<{ question: string }[]>, 'leer las preguntas previas') ?? [];
    return rows.map((row) => row.question);
  }

  async setPrepStep(interviewId: string, step: PrepStep): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({ prep_step: step })
      .eq('id', interviewId);
    unwrap(result as PostgrestLike<unknown>, `poner prep_step '${step}'`);
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
      .eq('id', interviewId);
    unwrap(result as PostgrestLike<unknown>, 'marcar la entrevista como ready');
  }

  async markPrepFailed(interviewId: string, errorCode: string): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({
        status: 'prep_failed' satisfies InterviewStatus,
        error_code: errorCode,
      })
      .eq('id', interviewId);
    unwrap(result as PostgrestLike<unknown>, 'marcar la entrevista como prep_failed');
  }

  async insertQuestionsAsked(
    userId: string,
    offerHash: string,
    area: string,
    questions: readonly string[],
  ): Promise<void> {
    const rows = questions.map((question) => ({
      user_id: userId,
      offer_hash: offerHash,
      area,
      question,
    }));
    const result = await this.db.from(INTERVIEW_QUESTIONS_ASKED_TABLE).insert(rows);
    unwrap(result as PostgrestLike<unknown>, 'guardar las preguntas de la entrevista');
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
    unwrap(result as PostgrestLike<unknown>, 'registrar el uso en llm_calls');
  }

  async refundDailyCap(userId: string): Promise<void> {
    try {
      const profile = await this.db
        .from(TABLES.profiles)
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
      const timezone = unwrap(
        profile as PostgrestLike<{ timezone: string | null }>,
        'leer la zona horaria del perfil',
      )?.timezone;
      const key = `interviews:day:${userId}:${userDay(timezone)}`;
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
