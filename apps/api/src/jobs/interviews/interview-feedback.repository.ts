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
import type { Purpose } from '../../llm/config.js';
import type { InterviewFeedback, InterviewPlan, InterviewStatus } from '../../interviews/interviews.types.js';

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

/** Toma el candado si está libre o si ya es de este mismo job (mismo script que `interview-prepare`). */
const ACQUIRE_LOCK_SCRIPT =
  "local v = redis.call('GET', KEYS[1]) if v == false or v == ARGV[1] then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end return 0";

/** Borra el candado solo si sigue siendo de este job. */
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

/** Vida del candado del parecer: el timeout del agente (120 s) más margen. */
export const FEEDBACK_LOCK_TTL_MS = 180_000;

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

export interface RecordFeedbackUsageInput {
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
    const result = await this.db
      .from(INTERVIEWS_TABLE)
      .update({ status: 'feedback_failed' satisfies InterviewStatus, error_code: errorCode })
      .eq('id', interviewId)
      .eq('status', 'feedback_pending' satisfies InterviewStatus);
    unwrapInsforge(result as InsforgeResult<unknown>);
  }

  async recordFeedbackUsage(input: RecordFeedbackUsageInput): Promise<void> {
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

  async acquireFeedbackLock(interviewId: string, owner: string): Promise<boolean> {
    const acquired = await this.redis.eval(
      ACQUIRE_LOCK_SCRIPT,
      1,
      feedbackLockKey(interviewId),
      owner,
      FEEDBACK_LOCK_TTL_MS,
    );
    return acquired === 1;
  }

  async releaseFeedbackLock(interviewId: string, owner: string): Promise<void> {
    try {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, feedbackLockKey(interviewId), owner);
    } catch {
      // Si no se puede soltar, caduca solo (FEEDBACK_LOCK_TTL_MS).
    }
  }
}

function feedbackLockKey(interviewId: string): string {
  return `interview:feedback:${interviewId}`;
}
