import { setTimeout as sleep } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';

import {
  ApiException,
  type ApiErrorCode,
  type ApiExceptionOptions,
} from '../common/api-error.js';
import type { StudyCycle, StudyCycleSession } from '../db/schema.js';
import { I18nService } from '../i18n/i18n.service.js';
import { RedisService } from '../redis/redis.service.js';
import { SESSION_ID_RE } from '../sessions/session-ownership.js';
import { toSessionInfoDto } from '../sessions/sessions.mapper.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import { SessionsService } from '../sessions/sessions.service.js';
import type { CreateSessionResultDto } from '../sessions/sessions.types.js';
import {
  InterviewsRepository,
  STUDY_CYCLE_SIZE,
  type StudyCycleWithSessions,
} from './interviews.repository.js';

/**
 * Lock de `POST .../cycle/sessions/:idx/start`: la apertura llama al modelo,
 * así que dura lo que un turno; el segundo tap espera y devuelve la misma
 * sesión (mismo patrón que `InterviewSessionService`).
 */
export const START_LOCK_TTL_SEC = 30;
const START_LOCK_POLL_MS = 250;
export function startLockKey(cycleId: string, idx: number): string {
  return `study:start:${cycleId}:${idx}`;
}

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
  constructor(
    private readonly repository: InterviewsRepository,
    private readonly sessions: SessionsService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Idempotente: si el ciclo ya existe completo lo devuelve tal cual; si una
   * escritura anterior se cortó a medias, el `upsert` completa lo que falte.
   */
  async create(userId: string, interviewId: string, acceptLanguage?: string): Promise<StudyCycleDto> {
    if (!SESSION_ID_RE.test(interviewId)) {
      throw await this.error('NOT_FOUND', userId, acceptLanguage);
    }

    const existing = await this.repository.findCycle(userId, interviewId);
    if (existing !== null && existing.sessions.length === STUDY_CYCLE_SIZE) {
      return toCycleDto(existing);
    }

    const interview = await this.repository.findById(userId, interviewId);
    if (interview === null) throw await this.error('NOT_FOUND', userId, acceptLanguage);
    if (interview.status !== 'feedback_ready' || interview.feedback === null) {
      throw await this.error('STUDY_CYCLE_NOT_AVAILABLE', userId, acceptLanguage, {
        extra: { status: interview.status },
      });
    }
    return toCycleDto(
      await this.repository.upsertCycle(userId, interviewId, interview.feedback.studyPlan),
    );
  }

  /** Un ciclo a medias (escritura cortada) se completa aquí también. */
  async get(userId: string, interviewId: string, acceptLanguage?: string): Promise<StudyCycleDto> {
    if (!SESSION_ID_RE.test(interviewId)) {
      throw await this.error('NOT_FOUND', userId, acceptLanguage);
    }
    const cycle = await this.repository.findCycle(userId, interviewId);
    if (cycle === null) throw await this.error('NOT_FOUND', userId, acceptLanguage);
    if (cycle.sessions.length < STUDY_CYCLE_SIZE) {
      return this.create(userId, interviewId, acceptLanguage);
    }
    return toCycleDto(cycle);
  }

  /**
   * Abre la sesión `idx` del ciclo: `409 CYCLE_NOT_ACTIVE` si el ciclo ya no
   * está `active`, `409 STUDY_SESSION_LOCKED` si alguna anterior no está
   * hecha (FR-29). Repetir una ya hecha está permitido. La apertura es la de
   * `POST /sessions` (`SessionsService.openStudySession`): grupo, onboarding,
   * una sola sesión activa, apertura degradada, etc.
   *
   * Serializado por `(ciclo, idx)` con un lock de Redis: un doble tap no abre
   * dos sesiones, el segundo devuelve la misma.
   */
  async start(
    userId: string,
    interviewId: string,
    idx: number,
    acceptLanguage?: string,
  ): Promise<CreateSessionResultDto> {
    if (!SESSION_ID_RE.test(interviewId)) {
      throw await this.error('NOT_FOUND', userId, acceptLanguage);
    }

    const cycle = await this.repository.findCycle(userId, interviewId);
    const row = cycle?.sessions.find((item) => item.idx === idx);
    if (cycle === null || row === undefined) {
      throw await this.error('NOT_FOUND', userId, acceptLanguage);
    }
    if (cycle.cycle.status !== 'active') {
      throw await this.error('CYCLE_NOT_ACTIVE', userId, acceptLanguage, {
        extra: { status: cycle.cycle.status },
      });
    }
    if (cycle.sessions.some((item) => item.idx < idx && item.done_at === null)) {
      throw await this.error('STUDY_SESSION_LOCKED', userId, acceptLanguage);
    }

    const key = startLockKey(cycle.cycle.id, idx);
    const deadline = Date.now() + START_LOCK_TTL_SEC * 1000;
    while (!(await this.redis.setIfAbsent(key, '1', START_LOCK_TTL_SEC))) {
      if (Date.now() >= deadline) {
        throw await this.error('SESSION_ALREADY_ACTIVE', userId, acceptLanguage);
      }
      await sleep(START_LOCK_POLL_MS);
    }
    try {
      // Dentro del lock: si el primer tap ya la abrió, es la misma sesión.
      const active = await this.sessionsRepository.findActiveStudySession(userId, row.id);
      if (active !== null) {
        return {
          session: toSessionInfoDto(active.session),
          opening: { text: active.openingText, callbackUsed: false },
        };
      }
      return await this.sessions.openStudySession(userId, row);
    } finally {
      await this.redis.del(key);
    }
  }

  /** El `locale` solo se busca cuando hay que traducir un error. */
  private async error(
    code: ApiErrorCode,
    userId: string,
    acceptLanguage?: string,
    options?: ApiExceptionOptions,
  ): Promise<ApiException> {
    const profile = await this.sessionsRepository.findProfile(userId);
    const locale = this.i18n.resolveLocale(profile?.locale, acceptLanguage);
    return ApiException.of(code, this.i18n.translate(code, locale), options);
  }
}

/** `done` / `available` (la primera no hecha) / `locked`, más "n de N" y duración sobre las filas reales. */
export function toCycleDto({ cycle, sessions }: StudyCycleWithSessions): StudyCycleDto {
  const firstPending = sessions.find((item) => item.done_at === null)?.idx;
  const state = (item: StudyCycleSession): StudySessionState =>
    item.done_at !== null ? 'done' : item.idx === firstPending ? 'available' : 'locked';
  return {
    cycleId: cycle.id,
    interviewId: cycle.interview_id,
    status: cycle.status,
    doneCount: sessions.filter((item) => item.done_at !== null).length,
    totalSessions: sessions.length,
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
