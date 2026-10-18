import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { SESSION_HARD_CAP_SEC } from '../config/product.js';
import type { Session } from '../db/schema.js';
import { InterviewSessionRepository } from './interview-session.repository.js';
import {
  SessionCloserService,
  type SessionCloseResult,
} from './session-closer.service.js';
import { SessionsRepository } from './sessions.repository.js';

/** FR-11: con menos respuestas no hay parecer (`too_short`). */
export const MIN_ANSWERS_FOR_FEEDBACK = 4;

/** Lo que el cierre necesita de la sesión (el sweeper no lee la fila entera). */
export type InterviewSessionRef = Pick<
  Session,
  'id' | 'interview_id' | 'active_sec' | 'turns_count'
>;

/** D4: la duración de una entrevista es su tiempo activo, no el reloj de pared. */
export function interviewDurationSec(session: Pick<Session, 'active_sec'>): number {
  return Math.min(SESSION_HARD_CAP_SEC, session.active_sec);
}

/**
 * Fin de la sesión de una entrevista (FR-11, D5). Una entrevista tiene **una**
 * sesión y su transcript nunca se parte:
 *
 * - `end` (Terminar, `POST /sessions/:id/end` o `done` del modelo): con menos
 *   de 4 respuestas y tiempo por delante la entrevista pasa a `too_short`
 *   pero la sesión sigue abierta para retomarla (sin `close_session`, XP ni
 *   brief). En cualquier otro caso, `closeSession`.
 * - `closeSession` (tope de tiempo, 8 respuestas o el sweeper a las 24 h):
 *   `close_session` una vez y la entrevista a `feedback_pending` (≥ 4) o a
 *   `too_short` con `resumable = false`.
 *
 * Separado de `InterviewSessionService` (abrir/retomar) para que el sweeper
 * del worker lo use sin arrastrar `LlmModule`.
 */
@Injectable()
export class InterviewCloserService {
  private readonly logger = new Logger(InterviewCloserService.name);

  constructor(
    private readonly repository: InterviewSessionRepository,
    private readonly closer: SessionCloserService,
    private readonly sessions: SessionsRepository,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async end(
    userId: string,
    session: InterviewSessionRef,
    wasActive: boolean,
  ): Promise<SessionCloseResult> {
    if (wasActive && (await this.pauseIfTooShort(userId, session))) {
      const profile = await this.sessions.findProfile(userId);
      return {
        xp_earned: 0,
        streak: profile?.streak ?? 0,
        is_double_day: false,
        next_is_boss: false,
        newBadges: [],
      };
    }
    return this.closeSession(userId, session, wasActive);
  }

  /**
   * `decide = false` cuando la sesión ya estaba cerrada: ni brief ni cambio
   * de estado de la entrevista.
   */
  async closeSession(
    userId: string,
    session: InterviewSessionRef,
    decide: boolean,
  ): Promise<SessionCloseResult> {
    const result = await this.closer.close({
      userId,
      sessionId: session.id,
      durationSec: interviewDurationSec(session),
      turnsCount: session.turns_count,
      decideBrief: decide,
    });
    if (decide && session.interview_id !== null) {
      await this.finishInterview(userId, session.interview_id);
    }
    return result;
  }

  /**
   * Encolado del parecer. Por ahora solo registra; F12.3.T1 lo conecta a
   * `enqueueInterviewFeedback`. Solo se llama con la entrevista ya en
   * `feedback_pending`.
   */
  async onInterviewSessionClosed(interviewId: string): Promise<void> {
    this.logger.log(
      `Entrevista ${interviewId} lista para el parecer (feedback_pending)`,
    );
  }

  /** `true` si dejó la entrevista en `too_short` retomable sin cerrar la sesión. */
  private async pauseIfTooShort(
    userId: string,
    session: InterviewSessionRef,
  ): Promise<boolean> {
    const maxSec = this.configService.get('INTERVIEW_MAX_SEC', { infer: true });
    if (session.interview_id === null || session.active_sec >= maxSec) {
      return false;
    }
    const interview = await this.repository.findInterview(
      userId,
      session.interview_id,
    );
    if (
      interview === null ||
      interview.answered_count >= MIN_ANSWERS_FOR_FEEDBACK ||
      (interview.status !== 'in_progress' && interview.status !== 'too_short')
    ) {
      return false;
    }
    await this.repository.finishInterview(
      userId,
      interview.id,
      'too_short',
      true,
    );
    return true;
  }

  private async finishInterview(
    userId: string,
    interviewId: string,
  ): Promise<void> {
    const interview = await this.repository.findInterview(userId, interviewId);
    if (
      interview === null ||
      (interview.status !== 'in_progress' && interview.status !== 'too_short')
    ) {
      return;
    }
    const enough = interview.answered_count >= MIN_ANSWERS_FOR_FEEDBACK;
    // La sesión ya está cerrada: un `too_short` de aquí no se puede retomar.
    await this.repository.finishInterview(
      userId,
      interviewId,
      enough ? 'feedback_pending' : 'too_short',
      false,
    );
    if (enough) await this.onInterviewSessionClosed(interviewId);
  }
}
