import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Profile, Session } from '../db/schema.js';
import {
  DEGRADED_REPLY,
  TURN_MAX_ATTEMPTS,
  type Provider as LlmProvider,
} from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import { buildInterviewTurnMessages } from '../llm/prompts/interview-turn.js';
import { InterviewTurnOutput } from '../llm/schemas.js';
import { effectivePlan } from '../profiles/plan.js';
import type { InterviewPlan } from '../interviews/interviews.types.js';
import {
  InterviewSessionRepository,
  type InterviewTurnRow,
} from './interview-session.repository.js';
import { InterviewCloserService } from './interview-closer.service.js';
import { competencyFor } from './scenario.js';
import { clampNote, roundLatency } from './sessions.mapper.js';
import { SessionsRepository } from './sessions.repository.js';
import type { TurnResultDto } from './sessions.types.js';
import {
  TurnsRepository,
  type InsertCorrectionRow,
} from './turns.repository.js';

/** D4: lo que más suma un turno a `active_sec`; una pausa más larga no cuenta. */
export const ACTIVE_GAP_CAP_SEC = 120;

/** Cierre fijo cuando la API termina la entrevista y el modelo no lo hizo. */
export const INTERVIEW_CLOSING_REPLY =
  "That's all the time we have. Thank you for your answers, we'll get back to you soon.";

const SESSION_NOT_ACTIVE_MESSAGE = 'Esta entrevista ya no está en curso.';

export interface InterviewTurnParams {
  readonly userId: string;
  readonly session: Session;
  readonly profile: Profile;
  readonly text: string;
  /** `idx` del turno del usuario, ya calculado por `TurnsService`. */
  readonly userTurnIdx: number;
  readonly onToken?: (delta: string) => void;
  readonly onReset?: () => void;
}

/** Lo que sale del modelo (o de la degradación) antes de aplicar las reglas. */
interface InterviewOutcome {
  readonly reply: string;
  readonly isFollowUp: boolean;
  readonly done: boolean;
  readonly corrections: InterviewTurnOutput['corrections'];
  readonly model: string | null;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  readonly latencyMs: number | null;
  readonly degraded: boolean;
}

/**
 * Turno de una sesión `kind = 'interview'` (C4, I3, F12.1.T2). `TurnsService`
 * ya resolvió propiedad, lock, ritmo, perfil y tope diario; aquí va lo propio
 * de la entrevista:
 *
 * - `active_sec += min(gap, 120)` desde el turno anterior (D4).
 * - Una repregunta por pregunta, impuesta aquí y no solo en el prompt: si el
 *   modelo repregunta una pregunta que ya tuvo la suya, la respuesta se cambia
 *   por la pregunta siguiente del plan.
 * - `interviews.answered_count` y `turns.question_idx`/`is_follow_up` (las
 *   etiquetas y `active_sec` van en la misma `record_turn` que el turno).
 * - Correcciones guardadas pero nunca enviadas (FR-10).
 * - Con `done`, `INTERVIEW_MAX_SEC` o las 8 respondidas termina
 *   (`InterviewCloserService.end`).
 *
 * También genera la apertura (`opening`) con la misma llamada al modelo.
 *
 * La pregunta de cada turno la decide el servicio (orden estricto del plan),
 * no el `questionIdx` del modelo.
 */
@Injectable()
export class InterviewTurnsService {
  private readonly logger = new Logger(InterviewTurnsService.name);

  constructor(
    private readonly repository: InterviewSessionRepository,
    private readonly turns: TurnsRepository,
    private readonly sessions: SessionsRepository,
    private readonly llm: LlmService,
    private readonly configService: ConfigService<Env, true>,
    private readonly closer: InterviewCloserService,
  ) {}

  async run(params: InterviewTurnParams): Promise<TurnResultDto> {
    const { userId, session, profile, text, userTurnIdx } = params;
    const [interview, transcript] = await Promise.all([
      session.interview_id === null
        ? null
        : this.repository.findInterview(userId, session.interview_id),
      this.repository.listTranscript(session.id),
    ]);
    if (
      interview === null ||
      interview.status !== 'in_progress' ||
      interview.plan === null
    ) {
      throw ApiException.of('SESSION_NOT_ACTIVE', SESSION_NOT_ACTIVE_MESSAGE);
    }

    const plan = interview.plan;
    const totalQuestions = plan.questions.length;
    const maxSec = this.configService.get('INTERVIEW_MAX_SEC', { infer: true });
    const warnSec = this.configService.get('INTERVIEW_WARN_SEC', {
      infer: true,
    });

    const lastTutor = transcript.findLast((line) => line.role === 'tutor');
    // El cierre va sin pregunta (null); tras él solo se sigue retomando, y
    // retomar agrega un turno etiquetado. El fallback es por si acaso.
    const pendingQ =
      lastTutor?.question_idx ??
      Math.min(interview.answered_count + 1, totalQuestions);
    const pendingFollowUp = lastTutor?.is_follow_up ?? false;
    const lastAt = transcript.at(-1)?.created_at ?? session.started_at;
    const activeSecDelta = activeGapSec(lastAt, new Date());
    const activeSec = session.active_sec + activeSecDelta;
    // Orden estricto: contestar la pregunta pendiente la deja respondida.
    const answeredCount = Math.max(interview.answered_count, pendingQ);
    const followUpUsedFor = [
      ...new Set(
        transcript
          .filter(
            (line) =>
              line.role === 'tutor' &&
              line.is_follow_up &&
              line.question_idx !== null,
          )
          .map((line) => line.question_idx!),
      ),
    ];

    await this.repository.insertTurn({
      sessionId: session.id,
      idx: userTurnIdx,
      role: 'user',
      text,
      questionIdx: pendingQ,
      isFollowUp: pendingFollowUp,
    });

    let outcome: InterviewOutcome;
    try {
      outcome = await this.complete(
        userId,
        session.id,
        profile,
        {
          plan,
          transcript: [
            ...transcript.map(toTranscriptLine),
            { role: 'candidate', text },
          ],
          answeredCount,
          followUpUsedFor,
          activeSec,
          locale: profile.locale,
          warnSec,
          // El turno pendiente se generó con el `active_sec` guardado: si ya
          // pasaba el aviso, ese turno anunció la última pregunta.
          lastQuestionAnnounced: session.active_sec >= warnSec,
        },
        params,
      );
    } catch (error) {
      await this.rollbackUserTurn(session.id, userTurnIdx);
      throw error;
    }

    // Reglas del servicio sobre lo que dijo el modelo.
    const done =
      outcome.done || activeSec >= maxSec || answeredCount >= totalQuestions;
    let reply = outcome.reply;
    let isFollowUp = !done && outcome.isFollowUp;
    if (outcome.degraded && !done) {
      // «¿Puedes repetirlo?»: la pregunta pendiente sigue siendo la misma.
      isFollowUp = pendingFollowUp;
    } else if (done && !outcome.done) {
      reply = INTERVIEW_CLOSING_REPLY;
    } else if (isFollowUp && followUpUsedFor.includes(pendingQ)) {
      this.logger.warn(
        `Segunda repregunta a Q${pendingQ} evitada en la sesión ${session.id}.`,
      );
      isFollowUp = false;
      reply =
        `Thank you. ${plan.questions.find((q) => q.idx === answeredCount + 1)?.text ?? ''}`.trim();
    }
    if (reply !== outcome.reply && params.onToken) {
      params.onReset?.();
      params.onToken(reply);
    }
    // El cierre no pregunta nada: en la app se queda en la última pregunta
    // hecha y en la base va sin pregunta (nunca una que no se hizo).
    const questionIdx =
      done || outcome.degraded || isFollowUp
        ? pendingQ
        : Math.min(answeredCount + 1, totalQuestions);

    // Correcciones guardadas para el parecer (FR-10), nunca devueltas.
    const corrections: InsertCorrectionRow[] = outcome.corrections.map(
      (correction) => ({
        sessionId: session.id,
        userId,
        turnIdx: userTurnIdx,
        original: correction.original,
        corrected: correction.corrected,
        category: correction.category,
        note: clampNote(correction.note),
      }),
    );
    // Turno, pregunta y tiempo activo en una sola transacción (`record_turn`).
    await this.turns.recordTurn({
      sessionId: session.id,
      tutorIdx: userTurnIdx + 1,
      text: reply,
      model: outcome.model,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      latencyMs: outcome.latencyMs,
      turnsCount: session.turns_count + 1,
      corrections,
      interview: {
        questionIdx: done ? null : questionIdx,
        isFollowUp,
        activeSecDelta,
      },
    });
    if (answeredCount !== interview.answered_count) {
      await this.repository.updateAnsweredCount(
        userId,
        interview.id,
        answeredCount,
      );
    }

    if (done) {
      await this.closer.end(
        userId,
        {
          ...session,
          turns_count: session.turns_count + 1,
          active_sec: activeSec,
        },
        true,
      );
    }

    return {
      turnIdx: userTurnIdx,
      reply,
      corrections: [],
      modelUsed: outcome.model,
      degraded: outcome.degraded,
      ...(outcome.degraded ? { unavailable: true } : {}),
      interview: {
        questionIdx,
        totalQuestions,
        competency: competencyFor(plan, questionIdx),
        remainingSec: Math.max(0, maxSec - activeSec),
        done,
      },
    };
  }

  /**
   * Apertura de la entrevista (I3): el modelo se presenta y hace la Q1. Sin
   * modelo, una presentación fija con la Q1 del plan.
   */
  async opening(
    userId: string,
    sessionId: string,
    profile: Profile,
    plan: InterviewPlan,
  ): Promise<{ text: string; model: string | null }> {
    const outcome = await this.complete(userId, sessionId, profile, {
      plan,
      transcript: [],
      answeredCount: 0,
      followUpUsedFor: [],
      activeSec: 0,
      locale: profile.locale,
      warnSec: this.configService.get('INTERVIEW_WARN_SEC', { infer: true }),
      lastQuestionAnnounced: false,
    });
    if (!outcome.degraded) return { text: outcome.reply, model: outcome.model };
    const first = plan.questions.find((q) => q.idx === 1)?.text ?? '';
    return {
      text: `Hi, I'll be your interviewer today. Please keep each answer to about one minute. ${first}`,
      model: null,
    };
  }

  /** Llamada al modelo de la entrevista (D7: combo del plan del usuario). */
  private async complete(
    userId: string,
    sessionId: string,
    profile: Profile,
    prompt: Parameters<typeof buildInterviewTurnMessages>[0],
    stream?: Pick<InterviewTurnParams, 'onToken' | 'onReset'>,
  ): Promise<InterviewOutcome> {
    const preference = await this.sessions.findChatModelPreference(userId);
    try {
      const result = await this.llm.complete({
        userId,
        sessionId,
        purpose: 'interview',
        messages: buildInterviewTurnMessages(prompt),
        schema: InterviewTurnOutput,
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
        onToken: stream?.onToken,
        onReset: stream?.onReset,
      });
      return {
        reply: result.data.reply,
        isFollowUp: result.data.isFollowUp,
        done: result.data.done,
        corrections: result.data.corrections,
        model: result.modelUsed,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: roundLatency(result.attempts.at(-1)?.latencyMs ?? null),
        degraded: false,
      };
    } catch (error) {
      if (!(error instanceof LlmUnavailableError)) throw error;
      this.logger.warn(`Llamada de entrevista degradada en la sesión ${sessionId}.`);
      return {
        reply: DEGRADED_REPLY,
        isFollowUp: false,
        done: false,
        corrections: [],
        model: null,
        tokensIn: null,
        tokensOut: null,
        latencyMs: null,
        degraded: true,
      };
    }
  }

  /** Borrado best-effort: nunca debe tapar el error original. */
  private async rollbackUserTurn(
    sessionId: string,
    idx: number,
  ): Promise<void> {
    try {
      await this.turns.deleteTurn(sessionId, idx);
    } catch (error) {
      this.logger.warn(
        `No se pudo deshacer el turno ${idx} de la sesión ${sessionId}: ${(error as Error).message}`,
      );
    }
  }
}

/** `min(gap, 120)` segundos desde el turno anterior, nunca negativo (D4). */
export function activeGapSec(lastTurnAtIso: string, now: Date): number {
  const gapSec = Math.floor(
    (now.getTime() - new Date(lastTurnAtIso).getTime()) / 1000,
  );
  return Math.min(ACTIVE_GAP_CAP_SEC, Math.max(0, gapSec));
}

function toTranscriptLine(line: InterviewTurnRow): {
  role: 'interviewer' | 'candidate';
  text: string;
} {
  return {
    role: line.role === 'tutor' ? 'interviewer' : 'candidate',
    text: line.text,
  };
}
