/**
 * Acceso a datos del job `interview-feedback` (F12.3.T1; arch 003
 * §Components C3, §Interfaces I1).
 *
 * Deliberadamente estrecho y sin reusar `InterviewsRepository` (el módulo
 * HTTP) ni `InterviewSessionRepository` (`sessions/`): mismo criterio que
 * `InterviewPrepareRepository` documenta en su cabecera — cada job trae su
 * propio acceso a los datos que necesita, sin depender de módulos que no son
 * su dependencia declarada.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import type { Redis } from 'ioredis';

import type { CorrectionCategory, Locale, TurnRole } from '../../db/schema.js';
import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { unwrapInsforge, type InsforgeResult } from '../../insforge/insforge-result.js';
import { REDIS_CACHE_CLIENT } from '../../redis/redis.constants.js';
import { TABLES } from '../../db/schema.js';
import type { InterviewFeedback, InterviewPlan, InterviewStatus } from '../../interviews/interviews.types.js';
import {
  acquireJobLock,
  insertAgentLlmCall,
  markInterviewFeedbackFailed,
  releaseJobLock,
  type RecordAgentUsageInput,
} from './interview-jobs.shared.js';

/** Mismo literal que `Interview.company` (`db/schema.ts`): no hay un tipo exportado propio para esta forma. */
interface InterviewCompany {
  readonly name: string;
  readonly industry?: string;
  readonly city?: string;
  readonly workMode?: string;
}

const INTERVIEWS_TABLE = 'interviews';
const SESSIONS_TABLE = 'sessions';
const TURNS_TABLE = 'turns';

/** Vida del candado del parecer: el timeout del agente (120 s) más margen. */
export const FEEDBACK_LOCK_TTL_MS = 180_000;

/**
 * Cuánto se guarda la respuesta del agente para que un reintento (memoria o
 * `feedback_ready` fallidos) no vuelva a llamarlo: más que todos los
 * reintentos de BullMQ y un `POST /interviews/:id/retry` cercano.
 */
export const FEEDBACK_AGENT_CACHE_TTL_SEC = 3600;

export interface InterviewFeedbackRow {
  readonly id: string;
  readonly user_id: string;
  readonly parent_interview_id: string | null;
  readonly status: InterviewStatus;
  readonly plan: InterviewPlan | null;
  readonly role: string | null;
  readonly company: InterviewCompany | null;
  readonly answered_count: number;
}

export interface FeedbackProfileRow {
  readonly display_name: string;
  readonly locale: Locale;
}

export interface TranscriptLineRow {
  readonly role: TurnRole;
  readonly text: string;
  readonly question_idx: number | null;
}

export interface SessionDataResult {
  readonly sessionId: string | null;
  readonly transcript: readonly TranscriptLineRow[];
}

export interface EnglishErrorRow {
  readonly original: string;
  readonly corrected: string;
  readonly category: CorrectionCategory;
}

export type RecordFeedbackUsageInput = RecordAgentUsageInput;

@Injectable()
export abstract class InterviewFeedbackRepository {
  abstract loadInterview(interviewId: string): Promise<InterviewFeedbackRow | null>;
  abstract loadProfile(userId: string): Promise<FeedbackProfileRow | null>;
  /** La sesión de la entrevista (D5: una sola) y su transcript, en orden. */
  abstract loadSessionData(userId: string, interviewId: string): Promise<SessionDataResult>;
  /** Correcciones de inglés guardadas en esa sesión (`englishErrors` de I1). */
  abstract loadEnglishErrors(sessionId: string | null): Promise<EnglishErrorRow[]>;
  /** `feedback` de la entrevista padre, para `previousFeedback` (re-entrevista). */
  abstract loadParentFeedback(parentInterviewId: string): Promise<InterviewFeedback | null>;
  /** `feedback_pending` → `feedback_ready` con el parecer. Idempotente por el filtro de estado. */
  abstract markFeedbackReady(interviewId: string, feedback: InterviewFeedback): Promise<void>;
  /** `feedback_pending` → `feedback_failed`. Solo desde `feedback_pending`. */
  abstract markFeedbackFailed(interviewId: string, errorCode: string): Promise<void>;
  abstract recordFeedbackUsage(input: RecordFeedbackUsageInput): Promise<void>;
  /** Candado `interview:feedback:{id}` mientras dura el job (mismo motivo que `interview-prepare`). */
  abstract acquireFeedbackLock(interviewId: string, owner: string): Promise<boolean>;
  abstract releaseFeedbackLock(interviewId: string, owner: string): Promise<void>;
  /**
   * Respuesta del agente ya obtenida (y su uso ya registrado) por un intento
   * anterior de esta entrevista, o `null`. Fail-open: con Redis caído, `null`.
   */
  abstract loadCachedAgentFeedback(interviewId: string): Promise<InterviewFeedback | null>;
  /** Guarda la respuesta del agente `FEEDBACK_AGENT_CACHE_TTL_SEC`. Fail-open. */
  abstract cacheAgentFeedback(interviewId: string, feedback: InterviewFeedback): Promise<void>;
}

@Injectable()
export class InsforgeInterviewFeedbackRepository extends InterviewFeedbackRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async loadInterview(interviewId: string): Promise<InterviewFeedbackRow | null> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .select('id,user_id,parent_interview_id,status,plan,role,company,answered_count')
      .eq('id', interviewId)
      .maybeSingle();
    return unwrapInsforge(result as InsforgeResult<InterviewFeedbackRow>);
  }

  async loadProfile(userId: string): Promise<FeedbackProfileRow | null> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('display_name,locale')
      .eq('user_id', userId)
      .maybeSingle();
    return unwrapInsforge(result as InsforgeResult<FeedbackProfileRow>);
  }

  /** D5: una entrevista tiene una sola sesión; sus turnos en orden. */
  async loadSessionData(userId: string, interviewId: string): Promise<SessionDataResult> {
    const sessionResult = await this.db
      .from(SESSIONS_TABLE)
      .select('id')
      .eq('interview_id', interviewId)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const session = unwrapInsforge(sessionResult as InsforgeResult<{ id: string }>);
    if (session === null) return { sessionId: null, transcript: [] };

    const turnsResult = await this.db
      .from(TURNS_TABLE)
      .select('role,text,question_idx')
      .eq('session_id', session.id)
      .order('idx', { ascending: true });
    const transcript = unwrapInsforge(turnsResult as InsforgeResult<TranscriptLineRow[]>) ?? [];
    return { sessionId: session.id, transcript };
  }

  async loadEnglishErrors(sessionId: string | null): Promise<EnglishErrorRow[]> {
    if (sessionId === null) return [];
    const result = await this.db
      .from(TABLES.corrections)
      .select('original,corrected,category')
      .eq('session_id', sessionId);
    return unwrapInsforge(result as InsforgeResult<EnglishErrorRow[]>) ?? [];
  }
  async loadParentFeedback(parentInterviewId: string): Promise<InterviewFeedback | null> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .select('feedback')
      .eq('id', parentInterviewId)
      .maybeSingle();
    return (
      unwrapInsforge(result as InsforgeResult<{ feedback: InterviewFeedback | null }>)?.feedback ??
      null
    );
  }

  async markFeedbackReady(interviewId: string, feedback: InterviewFeedback): Promise<void> {
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({ status: 'feedback_ready' satisfies InterviewStatus, feedback, error_code: null })
      .eq('id', interviewId)
      .eq('status', 'feedback_pending' satisfies InterviewStatus);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async markFeedbackFailed(interviewId: string, errorCode: string): Promise<void> {
    await markInterviewFeedbackFailed(this.db, interviewId, errorCode);
  }

  async recordFeedbackUsage(input: RecordFeedbackUsageInput): Promise<void> {
    await insertAgentLlmCall(this.db, input);
  }

  async acquireFeedbackLock(interviewId: string, owner: string): Promise<boolean> {
    return acquireJobLock(this.redis, feedbackLockKey(interviewId), owner, FEEDBACK_LOCK_TTL_MS);
  }

  async releaseFeedbackLock(interviewId: string, owner: string): Promise<void> {
    await releaseJobLock(this.redis, feedbackLockKey(interviewId), owner);
  }

  async loadCachedAgentFeedback(interviewId: string): Promise<InterviewFeedback | null> {
    try {
      const raw = await this.redis.get(feedbackAgentCacheKey(interviewId));
      return raw === null ? null : (JSON.parse(raw) as InterviewFeedback);
    } catch {
      return null;
    }
  }

  async cacheAgentFeedback(interviewId: string, feedback: InterviewFeedback): Promise<void> {
    try {
      await this.redis.set(
        feedbackAgentCacheKey(interviewId),
        JSON.stringify(feedback),
        'EX',
        FEEDBACK_AGENT_CACHE_TTL_SEC,
      );
    } catch {
      // Sin caché, un reintento vuelve a llamar al agente (y registra esa nueva llamada).
    }
  }
}

function feedbackAgentCacheKey(interviewId: string): string {
  return `interview:feedback:agent:${interviewId}`;
}

function feedbackLockKey(interviewId: string): string {
  return `interview:feedback:${interviewId}`;
}
