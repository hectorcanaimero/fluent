import { setTimeout as sleep } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ApiException,
  type ApiErrorCode,
  type ApiExceptionOptions,
} from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Interview, Locale, Profile, Session } from '../db/schema.js';
import { I18nService } from '../i18n/i18n.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  InterviewSessionRepository,
  type InterviewTurnRow,
} from '../sessions/interview-session.repository.js';
import { InterviewTurnsService } from '../sessions/interview-turns.service.js';
import { competencyFor } from '../sessions/scenario.js';
import { SESSION_ID_RE } from '../sessions/session-ownership.js';
import { OPENING_TURN_IDX } from '../sessions/sessions.constants.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import type { InterviewSessionDto } from '../sessions/sessions.types.js';
import type { InterviewPlan, InterviewStatus } from './interviews.types.js';

/** Estados desde los que `POST /interviews/:id/session` abre o retoma. */
const OPENABLE: readonly InterviewStatus[] = [
  'ready',
  'in_progress',
  'too_short',
];

/** Prefijo de la reapertura; se quita al retomar dos veces seguidas. */
export const WELCOME_BACK_PREFIX =
  "Welcome back, let's pick up where we left off. ";

/**
 * Lock de `POST /interviews/:id/session`: la apertura llama al modelo, así
 * que dura lo que un turno; la segunda petición espera y devuelve la misma
 * sesión.
 */
export const OPEN_LOCK_TTL_SEC = 30;
const OPEN_LOCK_POLL_MS = 250;
export function openLockKey(interviewId: string): string {
  return `interview:session:${interviewId}`;
}

/**
 * Sesión de la entrevista (C2/C4, F12.1.T2, D5): **una** por entrevista.
 *
 * - **Abrir** (`ready`): sesión `kind = 'interview'` con la apertura del
 *   entrevistador y la entrevista a `in_progress`.
 * - **Retomar** (`in_progress` con la sesión activa): la sesión tal cual.
 * - **Retomar un `too_short`** que el usuario terminó antes de tiempo (la
 *   sesión siguió abierta, ver `InterviewCloserService.end`): la misma sesión,
 *   la entrevista otra vez `in_progress` y un "welcome back" que repite la
 *   pregunta pendiente. Si la sesión ya se cerró (tope de tiempo o sweeper),
 *   `409 INTERVIEW_NOT_RESUMABLE`.
 *
 * Serializado por entrevista con un lock de Redis: dos POST a la vez no abren
 * dos sesiones ni insertan dos aperturas.
 */
@Injectable()
export class InterviewSessionService {
  constructor(
    private readonly repository: InterviewSessionRepository,
    private readonly sessions: SessionsRepository,
    private readonly interviewTurns: InterviewTurnsService,
    private readonly configService: ConfigService<Env, true>,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
  ) {}

  async open(
    userId: string,
    interviewId: string,
    acceptLanguage?: string,
  ): Promise<InterviewSessionDto> {
    const profile = await this.sessions.findProfile(userId);
    const locale = this.i18n.resolveLocale(profile?.locale, acceptLanguage);
    if (!SESSION_ID_RE.test(interviewId)) throw this.error('NOT_FOUND', locale);

    const key = openLockKey(interviewId);
    const deadline = Date.now() + OPEN_LOCK_TTL_SEC * 1000;
    while (!(await this.redis.setIfAbsent(key, '1', OPEN_LOCK_TTL_SEC))) {
      if (Date.now() >= deadline)
        throw this.error('INTERVIEW_NOT_OPENABLE', locale);
      await sleep(OPEN_LOCK_POLL_MS);
    }
    try {
      return await this.openLocked(userId, interviewId, locale, profile);
    } finally {
      await this.redis.del(key);
    }
  }

  private async openLocked(
    userId: string,
    interviewId: string,
    locale: Locale,
    profile: Profile | null,
  ): Promise<InterviewSessionDto> {
    const interview = await this.repository.findInterview(userId, interviewId);
    if (interview === null) throw this.error('NOT_FOUND', locale);
    if (!OPENABLE.includes(interview.status) || interview.plan === null) {
      throw this.error('INTERVIEW_NOT_OPENABLE', locale, {
        extra: { status: interview.status },
      });
    }
    if (profile === null || profile.onboarded_at === null)
      throw this.error('NOT_ONBOARDED', locale);
    const plan = interview.plan;

    const latest = await this.repository.findLatestSession(userId, interviewId);

    // Primera vez (o la apertura anterior falló y borró su sesión).
    if (latest === null && interview.status !== 'too_short') {
      // Una sola sesión activa por usuario (SPEC-04 §2), también aquí.
      const activeSessionId = await this.sessions.findActiveSessionId(userId);
      if (activeSessionId !== null) {
        throw this.error('SESSION_ALREADY_ACTIVE', locale, {
          extra: { activeSessionId },
        });
      }
      if (
        interview.status === 'ready' &&
        (await this.repository.markInProgress(userId, interviewId, [
          'ready',
        ])) === null
      ) {
        throw this.error('INTERVIEW_NOT_OPENABLE', locale);
      }

      const session = await this.repository.createSession(userId, interviewId);
      try {
        const opening = await this.interviewTurns.opening(
          userId,
          session.id,
          profile,
          plan,
        );
        const turn = {
          idx: OPENING_TURN_IDX,
          role: 'tutor' as const,
          text: opening.text,
          questionIdx: 1,
          isFollowUp: false,
        };
        await this.repository.insertTurn({
          sessionId: session.id,
          model: opening.model,
          ...turn,
        });
        return this.toDto(interview, plan, session, turn);
      } catch (error) {
        // Sin apertura no dejamos una sesión fantasma que bloquee con
        // SESSION_ALREADY_ACTIVE; la entrevista queda `in_progress` sin
        // sesión y el siguiente POST abre otra.
        await this.sessions.deleteSession(userId, session.id);
        throw error;
      }
    }

    // Una sola sesión por entrevista (D5): si ya se cerró no se retoma.
    if (
      latest === null ||
      latest.status !== 'active' ||
      (interview.status === 'too_short' && !interview.resumable)
    ) {
      throw this.error('INTERVIEW_NOT_RESUMABLE', locale, {
        extra: { status: interview.status },
      });
    }

    const transcript = await this.repository.listTranscript(latest.id);
    if (interview.status === 'in_progress') {
      const last = transcript.findLast((line) => line.role === 'tutor');
      return this.toDto(interview, plan, latest, {
        text: last?.text ?? '',
        questionIdx: last?.question_idx ?? 1,
      });
    }

    // `too_short` retomable: misma sesión, "welcome back" y la pregunta pendiente.
    if (
      (await this.repository.markInProgress(userId, interviewId, [
        'too_short',
      ])) === null
    ) {
      throw this.error('INTERVIEW_NOT_OPENABLE', locale);
    }
    const pending = pendingQuestion(plan, transcript, interview.answered_count);
    const turn = {
      idx: (transcript.at(-1)?.idx ?? -1) + 1,
      role: 'tutor' as const,
      text: `${WELCOME_BACK_PREFIX}${pending.text}`,
      questionIdx: pending.questionIdx,
      isFollowUp: pending.isFollowUp,
    };
    await this.repository.insertTurn({ sessionId: latest.id, ...turn });
    return this.toDto(interview, plan, latest, turn);
  }

  private toDto(
    interview: Interview,
    plan: InterviewPlan,
    session: Session,
    opening: { text: string; questionIdx: number },
  ): InterviewSessionDto {
    const maxSec = this.configService.get('INTERVIEW_MAX_SEC', { infer: true });
    return {
      sessionId: session.id,
      opening: opening.text,
      answeredCount: interview.answered_count,
      interview: {
        questionIdx: opening.questionIdx,
        totalQuestions: plan.questions.length,
        competency: competencyFor(plan, opening.questionIdx),
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

/**
 * Pregunta que quedó sin responder. Si el último turno es una pregunta del
 * entrevistador, esa (la del plan, o el texto de la repregunta); si es el
 * cierre (sin `question_idx`) u otra cosa, la siguiente del plan. Nunca
 * repite el cierre ni hace avanzar `answered_count`.
 */
export function pendingQuestion(
  plan: InterviewPlan,
  transcript: readonly InterviewTurnRow[],
  answeredCount: number,
): { questionIdx: number; isFollowUp: boolean; text: string } {
  const planText = (idx: number) =>
    plan.questions.find((q) => q.idx === idx)?.text ?? '';
  const last = transcript.at(-1);
  if (last?.role === 'tutor' && last.question_idx !== null) {
    if (last.is_follow_up) {
      const text = last.text.startsWith(WELCOME_BACK_PREFIX)
        ? last.text.slice(WELCOME_BACK_PREFIX.length)
        : last.text;
      return { questionIdx: last.question_idx, isFollowUp: true, text };
    }
    return {
      questionIdx: last.question_idx,
      isFollowUp: false,
      text: planText(last.question_idx),
    };
  }
  const idx = Math.min(answeredCount + 1, plan.questions.length);
  return { questionIdx: idx, isFollowUp: false, text: planText(idx) };
}
