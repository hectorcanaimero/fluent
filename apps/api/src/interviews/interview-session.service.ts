import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ApiException,
  type ApiErrorCode,
  type ApiExceptionOptions,
} from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { SESSION_HARD_CAP_SEC } from '../config/product.js';
import type { Interview, Locale, Profile, Session } from '../db/schema.js';
import { I18nService } from '../i18n/i18n.service.js';
import {
  TURN_MAX_ATTEMPTS,
  type Provider as LlmProvider,
} from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import { buildInterviewTurnMessages } from '../llm/prompts/interview-turn.js';
import { InterviewTurnOutput } from '../llm/schemas.js';
import { effectivePlan } from '../profiles/plan.js';
import {
  InterviewSessionRepository,
  type InterviewTurnRow,
} from '../sessions/interview-session.repository.js';
import { competencyFor } from '../sessions/scenario.js';
import {
  SessionCloserService,
  type SessionCloseResult,
} from '../sessions/session-closer.service.js';
import { SESSION_ID_RE } from '../sessions/session-ownership.js';
import { OPENING_TURN_IDX } from '../sessions/sessions.constants.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import type { InterviewSessionDto } from '../sessions/sessions.types.js';
import type { InterviewPlan, InterviewStatus } from './interviews.types.js';

/** FR-11: con menos respuestas no hay parecer (`too_short`). */
export const MIN_ANSWERS_FOR_FEEDBACK = 4;

/** Estados desde los que `POST /interviews/:id/session` abre o retoma. */
const OPENABLE: readonly InterviewStatus[] = [
  'ready',
  'in_progress',
  'too_short',
];

/**
 * Sesión de la entrevista (C2/C4, F12.1.T2): abrirla, retomarla y cerrarla.
 *
 * - **Abrir** (`ready`): sesión `kind = 'interview'` con la apertura del
 *   entrevistador (primer turno del prompt I3) y la entrevista a `in_progress`.
 * - **Retomar** (`in_progress`, FR-25): la sesión activa tal cual. Si el
 *   sweeper ya la cerró (24 h, D5) o la entrevista quedó en `too_short`, se
 *   abre otra sesión de la misma entrevista que arrastra `active_sec`; el
 *   transcript es la suma de todas (`InterviewSessionRepository.listTranscript`)
 *   y el entrevistador repite la pregunta pendiente.
 * - **Cerrar** (`done`, `INTERVIEW_MAX_SEC` o `POST /sessions/:id/end`):
 *   `SessionCloserService` como cualquier sesión y la entrevista a
 *   `feedback_pending` (≥ 4 respuestas) o `too_short`.
 *
 * Lo provee `SessionsModule` (lo usan `TurnsService` y `EndSessionService`) y
 * lo reexporta para `InterviewsController`: así no hay ciclo entre módulos.
 */
@Injectable()
export class InterviewSessionService {
  private readonly logger = new Logger(InterviewSessionService.name);

  constructor(
    private readonly repository: InterviewSessionRepository,
    private readonly sessions: SessionsRepository,
    private readonly closer: SessionCloserService,
    private readonly llm: LlmService,
    private readonly configService: ConfigService<Env, true>,
    private readonly i18n: I18nService,
  ) {}

  async open(
    userId: string,
    interviewId: string,
    acceptLanguage?: string,
  ): Promise<InterviewSessionDto> {
    const profile = await this.sessions.findProfile(userId);
    const locale = this.i18n.resolveLocale(profile?.locale, acceptLanguage);

    const interview = SESSION_ID_RE.test(interviewId)
      ? await this.repository.findInterview(userId, interviewId)
      : null;
    if (interview === null) throw this.error('NOT_FOUND', locale);
    if (!OPENABLE.includes(interview.status) || interview.plan === null) {
      throw this.error('INTERVIEW_NOT_OPENABLE', locale, {
        extra: { status: interview.status },
      });
    }
    if (profile === null || profile.onboarded_at === null)
      throw this.error('NOT_ONBOARDED', locale);

    const [latest, transcript] = await Promise.all([
      this.repository.findLatestSession(userId, interviewId),
      this.repository.listTranscript(userId, interviewId),
    ]);

    // Retomar la sesión que sigue abierta: misma sesión, mismo progreso.
    if (interview.status === 'in_progress' && latest?.status === 'active') {
      return this.toDto(
        interview,
        interview.plan,
        latest,
        transcript.findLast((line) => line.role === 'tutor'),
      );
    }

    // Una sola sesión activa por usuario (SPEC-04 §2), también aquí.
    const activeSessionId = await this.sessions.findActiveSessionId(userId);
    if (activeSessionId !== null) {
      throw this.error('SESSION_ALREADY_ACTIVE', locale, {
        extra: { activeSessionId },
      });
    }

    if (interview.status !== 'in_progress') {
      const moved = await this.repository.markInProgress(userId, interviewId, [
        'ready',
        'too_short',
      ]);
      // Otra petición se adelantó: que el cliente reintente y la retome.
      if (moved === null) throw this.error('INTERVIEW_NOT_OPENABLE', locale);
    }

    // ponytail: retomar un `too_short` que ya gastó INTERVIEW_MAX_SEC solo deja
    // una respuesta más; dar tiempo extra si eso molesta en la práctica.
    const session = await this.repository.createSession(
      userId,
      interviewId,
      latest?.active_sec ?? 0,
    );
    try {
      const opening = await this.opening(
        userId,
        session,
        profile,
        interview.plan,
        transcript,
      );
      await this.repository.insertTurn({
        sessionId: session.id,
        idx: OPENING_TURN_IDX,
        role: 'tutor',
        ...opening,
      });
      return this.toDto(
        { ...interview, status: 'in_progress' },
        interview.plan,
        session,
        {
          role: 'tutor',
          text: opening.text,
          created_at: session.started_at,
          question_idx: opening.questionIdx,
          is_follow_up: opening.isFollowUp,
        },
      );
    } catch (error) {
      // Sin apertura no dejamos una sesión fantasma que bloquee con
      // SESSION_ALREADY_ACTIVE; la entrevista queda `in_progress` y el
      // siguiente POST abre otra.
      await this.sessions.deleteSession(userId, session.id);
      throw error;
    }
  }

  /**
   * Cierre de una sesión `interview` (F12.1.T2, FR-11). `decide = false` cuando
   * la sesión ya estaba cerrada: ni brief ni cambio de estado de la entrevista
   * (que puede estar ya en otra sesión retomada).
   */
  async closeSession(
    userId: string,
    session: Session,
    decide: boolean,
  ): Promise<SessionCloseResult> {
    const result = await this.closer.close({
      userId,
      sessionId: session.id,
      // D4: la duración es el tiempo activo, no el reloj de pared con pausas.
      durationSec: Math.min(SESSION_HARD_CAP_SEC, session.active_sec),
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

  private async finishInterview(
    userId: string,
    interviewId: string,
  ): Promise<void> {
    const interview = await this.repository.findInterview(userId, interviewId);
    if (interview === null || interview.status !== 'in_progress') return;

    const status =
      interview.answered_count >= MIN_ANSWERS_FOR_FEEDBACK
        ? 'feedback_pending'
        : 'too_short';
    await this.repository.finishInterview(userId, interviewId, status);
    if (status === 'feedback_pending')
      await this.onInterviewSessionClosed(interviewId);
  }

  /**
   * Primer turno de la sesión. Entrevista nueva: el modelo se presenta y hace
   * la Q1 (I3). Retomada: se repite lo último que preguntó, sin modelo.
   */
  private async opening(
    userId: string,
    session: Session,
    profile: Profile,
    plan: InterviewPlan,
    transcript: readonly InterviewTurnRow[],
  ): Promise<{
    text: string;
    questionIdx: number;
    isFollowUp: boolean;
    model: string | null;
  }> {
    const last = transcript.findLast((line) => line.role === 'tutor');
    if (last !== undefined) {
      return {
        text: `Welcome back, let's pick up where we left off. ${last.text}`,
        questionIdx: last.question_idx ?? 1,
        isFollowUp: last.is_follow_up ?? false,
        model: null,
      };
    }

    const preference = await this.sessions.findChatModelPreference(userId);
    try {
      const result = await this.llm.complete({
        userId,
        sessionId: session.id,
        purpose: 'interview',
        messages: buildInterviewTurnMessages({
          plan,
          transcript: [],
          answeredCount: 0,
          followUpUsedFor: [],
          activeSec: 0,
          locale: profile.locale,
          warnSec: this.configService.get('INTERVIEW_WARN_SEC', {
            infer: true,
          }),
          lastQuestionAnnounced: false,
        }),
        schema: InterviewTurnOutput,
        // D7: los turnos usan el combo del plan del usuario.
        plan: effectivePlan(profile),
        preference:
          preference === null
            ? null
            : {
                provider: preference.provider as LlmProvider,
                model: preference.model,
              },
        promptVersion: String(
          this.configService.get('PROMPT_VERSION', { infer: true }),
        ),
        maxAttempts: TURN_MAX_ATTEMPTS,
      });
      return {
        text: result.data.reply,
        questionIdx: 1,
        isFollowUp: false,
        model: result.modelUsed,
      };
    } catch (error) {
      if (!(error instanceof LlmUnavailableError)) throw error;
      this.logger.warn(
        `Apertura degradada de la entrevista en la sesión ${session.id}.`,
      );
      const first = plan.questions.find((q) => q.idx === 1)?.text ?? '';
      return {
        text: `Hi, I'll be your interviewer today. Please keep each answer to about one minute. ${first}`,
        questionIdx: 1,
        isFollowUp: false,
        model: null,
      };
    }
  }

  private toDto(
    interview: Interview,
    plan: InterviewPlan,
    session: Session,
    lastTutor: InterviewTurnRow | undefined,
  ): InterviewSessionDto {
    const questionIdx = lastTutor?.question_idx ?? 1;
    const maxSec = this.configService.get('INTERVIEW_MAX_SEC', { infer: true });
    return {
      sessionId: session.id,
      opening: lastTutor?.text ?? '',
      answeredCount: interview.answered_count,
      interview: {
        questionIdx,
        totalQuestions: plan.questions.length,
        competency: competencyFor(plan, questionIdx),
        remainingSec: Math.max(0, maxSec - session.active_sec),
        done: false,
      },
    };
  }

  private error(
    code: ApiErrorCode,
    locale: Locale,
    options?: ApiExceptionOptions,
  ): ApiException {
    return ApiException.of(code, this.i18n.translate(code, locale), options);
  }
}
