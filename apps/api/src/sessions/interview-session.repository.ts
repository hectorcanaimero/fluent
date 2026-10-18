import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import {
  TABLES,
  type Interview,
  type Session,
  type TurnRole,
} from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import type { InterviewStatus } from '../interviews/interviews.types.js';
import { INTERVIEW_TOPIC } from './scenario.js';

/** Turno de cualquier sesión de la entrevista, con su pregunta (F12.1.T2). */
export interface InterviewTurnRow {
  readonly idx: number;
  readonly role: TurnRole;
  readonly text: string;
  readonly created_at: string;
  readonly question_idx: number | null;
  readonly is_follow_up: boolean | null;
}

/** Turno a insertar con su pregunta del plan. */
export interface InsertInterviewTurnRow {
  readonly sessionId: string;
  readonly idx: number;
  readonly role: TurnRole;
  readonly text: string;
  readonly questionIdx: number;
  readonly isFollowUp: boolean;
  readonly model?: string | null;
}

/**
 * Acceso a datos de la sesión de entrevista (C4): la fila de `interviews` que
 * leen los turnos, su única sesión `kind = 'interview'` (D5) y sus turnos con
 * `question_idx`/`is_follow_up`.
 *
 * Vive en `sessions/` y no en `InterviewsRepository` porque lo usan
 * `TurnsService` y `EndSessionService`, y `SessionsModule` no importa el
 * módulo `interviews` (es al revés). Mismo aislamiento que el resto: lectura
 * de una entrevista o sesión concreta con filtro doble `id` + `user_id`.
 */
@Injectable()
export class InterviewSessionRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient,
  ) {}

  async findInterview(
    userId: string,
    interviewId: string,
  ): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select('*')
      .eq('id', interviewId)
      .eq('user_id', userId)
      .maybeSingle();
    return unwrapInsforge<Interview>(result);
  }

  /**
   * `from` → `in_progress` de forma atómica: `null` si la entrevista ya no
   * estaba en ninguno de esos estados (otra petición se adelantó).
   */
  async markInProgress(
    userId: string,
    interviewId: string,
    from: readonly InterviewStatus[],
  ): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'in_progress' })
      .eq('id', interviewId)
      .eq('user_id', userId)
      .in('status', [...from])
      .select('*')
      .maybeSingle();
    return unwrapInsforge<Interview>(result);
  }

  /**
   * `in_progress`/`too_short` → `feedback_pending`/`too_short` con su
   * `resumable` (D5); no pisa ningún otro estado. `too_short` entra aquí
   * cuando el sweeper cierra una entrevista que el usuario dejó en pausa.
   */
  async finishInterview(
    userId: string,
    interviewId: string,
    status: Extract<InterviewStatus, 'feedback_pending' | 'too_short'>,
    resumable: boolean,
  ): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status, resumable })
      .eq('id', interviewId)
      .eq('user_id', userId)
      .in('status', ['in_progress', 'too_short']);
    unwrapInsforge(result);
  }

  /**
   * `feedback_pending` → `feedback_failed` cuando no se pudo encolar el
   * parecer (F12.3.T1): así `POST /interviews/:id/retry` lo puede reencolar.
   */
  async markFeedbackEnqueueFailed(interviewId: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'feedback_failed', error_code: 'enqueue_failed' })
      .eq('id', interviewId)
      .eq('status', 'feedback_pending');
    unwrapInsforge(result);
  }

  async updateAnsweredCount(
    userId: string,
    interviewId: string,
    answeredCount: number,
  ): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ answered_count: answeredCount })
      .eq('id', interviewId)
      .eq('user_id', userId);
    unwrapInsforge(result);
  }

  /** Sesión más reciente de la entrevista, o `null` si nunca se abrió. */
  async findLatestSession(
    userId: string,
    interviewId: string,
  ): Promise<Session | null> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('*')
      .eq('interview_id', interviewId)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return unwrapInsforge<Session>(result);
  }

  /** La sesión `interview` de la entrevista; hay una sola (D5). */
  async createSession(userId: string, interviewId: string): Promise<Session> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .insert({
        user_id: userId,
        kind: 'interview',
        topic: INTERVIEW_TOPIC,
        interview_id: interviewId,
        status: 'active',
      })
      .select('*')
      .maybeSingle();
    const created = unwrapInsforge<Session>(result);
    if (created === null) {
      throw new Error(
        'InterviewSessionRepository.createSession: la inserción no devolvió ninguna fila',
      );
    }
    return created;
  }

  /** Transcript de la sesión de la entrevista, en orden. */
  async listTranscript(sessionId: string): Promise<InterviewTurnRow[]> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .select('idx, role, text, created_at, question_idx, is_follow_up')
      .eq('session_id', sessionId)
      .order('idx', { ascending: true });
    return unwrapInsforge<InterviewTurnRow[]>(result) ?? [];
  }

  async insertTurn(row: InsertInterviewTurnRow): Promise<void> {
    const result = await this.admin.database.from(TABLES.turns).insert({
      session_id: row.sessionId,
      idx: row.idx,
      role: row.role,
      text: row.text,
      model: row.model ?? null,
      question_idx: row.questionIdx,
      is_follow_up: row.isFollowUp,
    });
    unwrapInsforge(result);
  }
}
