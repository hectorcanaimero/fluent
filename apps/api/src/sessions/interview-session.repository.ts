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

/** Turno de cualquier sesión de la entrevista, con su pregunta (F12.1.T2). */
export interface InterviewTurnRow {
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
 * leen los turnos, las sesiones `kind = 'interview'` y las columnas
 * `question_idx`/`is_follow_up` de `turns`.
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

  /** `in_progress` → `feedback_pending`/`too_short`; no pisa otro estado. */
  async finishInterview(
    userId: string,
    interviewId: string,
    status: Extract<InterviewStatus, 'feedback_pending' | 'too_short'>,
  ): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status })
      .eq('id', interviewId)
      .eq('user_id', userId)
      .eq('status', 'in_progress');
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

  /** Sesión `interview` nueva; `activeSec` arrastra el tiempo de las anteriores (D4/D5). */
  async createSession(
    userId: string,
    interviewId: string,
    activeSec: number,
  ): Promise<Session> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .insert({
        user_id: userId,
        kind: 'interview',
        topic: 'Entrevista',
        interview_id: interviewId,
        active_sec: activeSec,
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

  async updateActiveSec(
    userId: string,
    sessionId: string,
    activeSec: number,
  ): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .update({ active_sec: activeSec })
      .eq('id', sessionId)
      .eq('user_id', userId);
    unwrapInsforge(result);
  }

  /**
   * Transcript de la entrevista entera, en orden: todas sus sesiones (una por
   * cada vez que se retomó tras `too_short` o un abandono) y sus turnos.
   */
  async listTranscript(
    userId: string,
    interviewId: string,
  ): Promise<InterviewTurnRow[]> {
    const sessionsResult = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('interview_id', interviewId)
      .eq('user_id', userId)
      .order('started_at', { ascending: true });
    const sessionIds = (
      unwrapInsforge<Array<{ id: string }>>(sessionsResult) ?? []
    ).map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const turnsResult = await this.admin.database
      .from(TABLES.turns)
      .select(
        'session_id, idx, role, text, created_at, question_idx, is_follow_up',
      )
      .in('session_id', sessionIds)
      .order('idx', { ascending: true });
    const rows =
      unwrapInsforge<
        Array<InterviewTurnRow & { session_id: string; idx: number }>
      >(turnsResult) ?? [];

    const order = new Map(sessionIds.map((id, i) => [id, i]));
    return rows
      .sort(
        (a, b) =>
          order.get(a.session_id)! - order.get(b.session_id)! || a.idx - b.idx,
      )
      .map(({ role, text, created_at, question_idx, is_follow_up }) => ({
        role,
        text,
        created_at,
        question_idx,
        is_follow_up,
      }));
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

  /** Etiqueta un turno que ya escribió `record_turn` (que no conoce estas columnas). */
  async tagTurn(
    sessionId: string,
    idx: number,
    questionIdx: number,
    isFollowUp: boolean,
  ): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .update({ question_idx: questionIdx, is_follow_up: isFollowUp })
      .eq('session_id', sessionId)
      .eq('idx', idx);
    unwrapInsforge(result);
  }
}
