import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ApiException,
  type ApiErrorCode,
  type ApiExceptionOptions,
} from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Locale, StudyCycle, StudyCycleSession } from '../db/schema.js';
import { I18nService } from '../i18n/i18n.service.js';
import { MAX_FACTS_IN_PROMPT, type Provider as LlmProvider } from '../llm/config.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import { buildTurnMessages } from '../llm/prompts/turn.js';
import { TurnOutput } from '../llm/schemas.js';
import { effectivePlan } from '../profiles/plan.js';
import { studyScenario } from '../sessions/scenario.js';
import { SESSION_ID_RE } from '../sessions/session-ownership.js';
import { roundLatency, toSessionInfoDto } from '../sessions/sessions.mapper.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import type { CreateSessionResultDto } from '../sessions/sessions.types.js';
import {
  InterviewsRepository,
  STUDY_CYCLE_SIZE,
  type StudyCycleWithSessions,
} from './interviews.repository.js';

/** Apertura fija si se agota la cadena de modelos (SPEC-03 §6), como `openingFor`. */
export const STUDY_DEGRADED_OPENING =
  "Hi! Let's practice today's study topic. Tell me what you already know about it.";

export type StudySessionState = 'done' | 'available' | 'locked';

export interface StudyCycleSessionDto {
  readonly idx: number;
  readonly focus: string;
  readonly title: string;
  readonly format: 'guided' | 'roleplay';
  readonly estMin: number;
  readonly state: StudySessionState;
}

/** `GET`/`POST /interviews/:id/cycle` (F13.1.T1, IE-07). */
export interface StudyCycleDto {
  readonly cycleId: string;
  readonly interviewId: string;
  readonly status: StudyCycle['status'];
  /** "n de 5". */
  readonly doneCount: number;
  readonly totalSessions: number;
  /** Duración total en minutos. */
  readonly totalMin: number;
  readonly sessions: readonly StudyCycleSessionDto[];
}

/**
 * Ciclo de estudio (C2/C4, F13.1.T1, FR-17/FR-29): se arma desde el
 * `studyPlan` del parecer y sus 5 sesiones se desbloquean en orden. Cada
 * sesión es una sesión normal `kind = 'study'` (turnos, correcciones, XP y
 * racha); el cierre la marca como hecha en `SessionCloserService`.
 */
@Injectable()
export class StudyCycleService {
  private readonly logger = new Logger(StudyCycleService.name);

  constructor(
    private readonly repository: InterviewsRepository,
    private readonly sessions: SessionsRepository,
    private readonly llm: LlmService,
    private readonly configService: ConfigService<Env, true>,
    private readonly i18n: I18nService,
  ) {}

  /** Idempotente: si el ciclo ya existe lo devuelve tal cual. */
  async create(userId: string, interviewId: string, acceptLanguage?: string): Promise<StudyCycleDto> {
    const locale = await this.locale(userId, acceptLanguage);
    if (!SESSION_ID_RE.test(interviewId)) throw this.error('NOT_FOUND', locale);

    const existing = await this.repository.findCycle(userId, interviewId);
    if (existing !== null && existing.sessions.length === STUDY_CYCLE_SIZE) {
      return toCycleDto(existing);
    }

    const interview = await this.repository.findById(userId, interviewId);
    if (interview === null) throw this.error('NOT_FOUND', locale);
    if (interview.status !== 'feedback_ready' || interview.feedback === null) {
      throw this.error('STUDY_CYCLE_NOT_AVAILABLE', locale, {
        extra: { status: interview.status },
      });
    }
    return toCycleDto(
      await this.repository.upsertCycle(userId, interviewId, interview.feedback.studyPlan),
    );
  }

  async get(userId: string, interviewId: string, acceptLanguage?: string): Promise<StudyCycleDto> {
    const locale = await this.locale(userId, acceptLanguage);
    if (!SESSION_ID_RE.test(interviewId)) throw this.error('NOT_FOUND', locale);
    const cycle = await this.repository.findCycle(userId, interviewId);
    if (cycle === null) throw this.error('NOT_FOUND', locale);
    return toCycleDto(cycle);
  }

  /**
   * Abre la sesión `idx` del ciclo: `409 STUDY_SESSION_LOCKED` si alguna
   * anterior no está hecha (FR-29). Repetir una ya hecha está permitido.
   * Misma apertura que `POST /sessions` (prompt de turno con el bloque de
   * foco y apertura degradada si se agota la cadena).
   */
  async start(
    userId: string,
    interviewId: string,
    idx: number,
    acceptLanguage?: string,
  ): Promise<CreateSessionResultDto> {
    const profile = await this.sessions.findProfile(userId);
    const locale = this.i18n.resolveLocale(profile?.locale, acceptLanguage);
    if (!SESSION_ID_RE.test(interviewId)) throw this.error('NOT_FOUND', locale);

    const cycle = await this.repository.findCycle(userId, interviewId);
    const row = cycle?.sessions.find((item) => item.idx === idx);
    if (cycle === null || row === undefined) throw this.error('NOT_FOUND', locale);
    if (cycle.sessions.some((item) => item.idx < idx && item.done_at === null)) {
      throw this.error('STUDY_SESSION_LOCKED', locale);
    }
    if (profile === null || profile.onboarded_at === null) {
      throw this.error('NOT_ONBOARDED', locale);
    }
    const activeSessionId = await this.sessions.findActiveSessionId(userId);
    if (activeSessionId !== null) {
      throw this.error('SESSION_ALREADY_ACTIVE', locale, { extra: { activeSessionId } });
    }

    const scenario = studyScenario(row);
    const [brief, facts, preference] = await Promise.all([
      this.sessions.findBriefText(userId),
      this.sessions.listConfirmedFacts(userId, MAX_FACTS_IN_PROMPT),
      this.sessions.findChatModelPreference(userId),
    ]);
    const messages = buildTurnMessages({
      locale: profile.locale,
      level: profile.level,
      kind: 'study',
      study: scenario.study,
      brief,
      facts: facts.map((fact) => fact.text),
      isFirstTurn: true,
    });

    const session = await this.repository.createStudySession(userId, row);
    let opening: {
      text: string;
      model: string | null;
      tokensIn: number | null;
      tokensOut: number | null;
      latencyMs: number | null;
    };
    try {
      const result = await this.llm.complete({
        userId,
        sessionId: session.id,
        purpose: 'turn',
        messages,
        schema: TurnOutput,
        plan: effectivePlan(profile),
        preference:
          preference === null
            ? null
            : { provider: preference.provider as LlmProvider, model: preference.model },
        promptVersion: String(this.configService.get('PROMPT_VERSION', { infer: true })),
      });
      opening = {
        text: result.data.reply,
        model: result.modelUsed,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: roundLatency(result.attempts.at(-1)?.latencyMs ?? null),
      };
    } catch (error) {
      if (!(error instanceof LlmUnavailableError)) {
        // Sin sesión fantasma que bloquee con SESSION_ALREADY_ACTIVE.
        await this.sessions.deleteSession(userId, session.id);
        throw error;
      }
      this.logger.warn(`Apertura degradada de la sesión de estudio ${session.id}.`);
      opening = { text: STUDY_DEGRADED_OPENING, model: null, tokensIn: null, tokensOut: null, latencyMs: null };
    }

    const updated = await this.sessions.updateAfterOpening(userId, session.id, {
      chatModelUsed: opening.model,
    });
    await this.sessions.insertOpeningTurn({ sessionId: session.id, ...opening });

    return {
      session: toSessionInfoDto(updated ?? session),
      opening: { text: opening.text, callbackUsed: false },
    };
  }

  private async locale(userId: string, acceptLanguage?: string): Promise<Locale> {
    const profile = await this.sessions.findProfile(userId);
    return this.i18n.resolveLocale(profile?.locale, acceptLanguage);
  }

  private error(code: ApiErrorCode, locale: Locale, options?: ApiExceptionOptions): ApiException {
    return ApiException.of(code, this.i18n.translate(code, locale), options);
  }
}

/** `done` / `available` (la primera no hecha) / `locked`, más "n de 5" y duración. */
export function toCycleDto({ cycle, sessions }: StudyCycleWithSessions): StudyCycleDto {
  const firstPending = sessions.find((item) => item.done_at === null)?.idx;
  const state = (item: StudyCycleSession): StudySessionState =>
    item.done_at !== null ? 'done' : item.idx === firstPending ? 'available' : 'locked';
  return {
    cycleId: cycle.id,
    interviewId: cycle.interview_id,
    status: cycle.status,
    doneCount: sessions.filter((item) => item.done_at !== null).length,
    totalSessions: STUDY_CYCLE_SIZE,
    totalMin: sessions.reduce((sum, item) => sum + item.est_min, 0),
    sessions: sessions.map((item) => ({
      idx: item.idx,
      focus: item.focus,
      title: item.title,
      format: item.format,
      estMin: item.est_min,
      state: state(item),
    })),
  };
}
