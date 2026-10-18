import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException, type ApiErrorCode, type ApiExceptionOptions } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Interview, Locale, StudyCycle } from '../db/schema.js';
import { I18nService } from '../i18n/i18n.service.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import { effectivePlan } from '../profiles/plan.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { RedisService } from '../redis/redis.service.js';
import { SESSION_ID_RE } from '../sessions/session-ownership.js';
import { secondsUntilUserMidnight, userDay } from '../sessions/user-day.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewsRepository, type InterviewListRow } from './interviews.repository.js';
import type {
  InterviewFeedback,
  InterviewStatus,
  InterviewType,
  PrepStep,
  SeniorityLevel,
} from './interviews.types.js';

/** Hosts de LinkedIn que `interview-agent` tampoco puede leer (D8). */
const LINKEDIN_HOSTS = ['linkedin.com', 'lnkd.in'];

/* ============================================================================
   DTOs de salida (I2)
   ========================================================================== */

export interface InterviewQuotaDto {
  /** `null` cuando `INTERVIEWS_DAILY_CAP = 0` (sin tope). */
  readonly remaining: number | null;
  /** `0` significa «sin tope», no «cero entrevistas». */
  readonly limit: number;
  readonly requiresPro: boolean;
  readonly freeNotice: true;
}

export interface InterviewDto {
  readonly id: string;
  readonly type: InterviewType;
  readonly status: InterviewStatus;
  readonly prepStep: PrepStep | null;
  readonly createdAt: string;
}

export interface InterviewCompetencyDto {
  readonly id: string;
  readonly name: string;
}

/**
 * Detalle de `GET /interviews/:id`: estado, `prepStep`, ficha y competencias
 * por nombre. **Nunca** las preguntas del plan (FR-7) — no hay ningún campo
 * `questions` aquí, solo `questionCount`.
 */
export interface InterviewDetailDto extends InterviewDto {
  readonly company: { name: string; industry?: string; city?: string; workMode?: string } | null;
  readonly role: string | null;
  readonly area: string | null;
  readonly seniority: SeniorityLevel | null;
  readonly questionCount: number | null;
  readonly estimatedMin: number | null;
  readonly competencies: readonly InterviewCompetencyDto[];
  readonly errorCode: string | null;
  /** `too_short` que se puede retomar con `POST /interviews/:id/session` (D5). */
  readonly resumable: boolean;
}

export interface InterviewListItemDto extends InterviewDto {
  readonly company: { name: string } | null;
  readonly role: string | null;
  readonly historyStatus: string;
  /** `too_short` que se puede retomar (D5). */
  readonly resumable: boolean;
  /** Viene de `POST /interviews/:id/reinterview` (FR-19). */
  readonly isReinterview: boolean;
  /** Sesiones del ciclo hechas; `null` sin ciclo (F13.1.T1). */
  readonly cycleCompletedSessions: number | null;
  readonly cycleStatus: StudyCycle['status'] | null;
}

export interface InterviewListResultDto {
  readonly items: readonly InterviewListItemDto[];
}

/** `GET /interviews/:id/feedback` (I1 `InterviewFeedback` sin `usage`: detalle interno del agente, FR-7 por analogía). */
export type InterviewFeedbackDto = Omit<InterviewFeedback, 'usage'>;

/** `202` mientras el parecer sigue `feedback_pending`. */
export interface InterviewFeedbackPendingDto {
  readonly status: 'feedback_pending';
}

/** Resultado de `InterviewsService.feedback`: el controller fija el `statusCode` en la respuesta. */
export interface InterviewFeedbackResult {
  readonly statusCode: 200 | 202;
  readonly body: InterviewFeedbackDto | InterviewFeedbackPendingDto;
}

/**
 * `GET /interviews/quota`, `POST /interviews`, `GET /interviews`,
 * `GET /interviews/:id`, `POST /interviews/:id/retry` (I2, F10.3.T2).
 *
 * Reglas de negocio de SPEC-02 §4.3 equivalente del simulador
 * (`docs/arch/003-simulador-entrevistas.md` §I2/§Decisions):
 * - D8: el host de LinkedIn se detecta en Nest, antes de tocar el agente ni
 *   el tope diario.
 * - El tope diario (`interviews:day:{userId}:{userDay}`) usa el mismo patrón
 *   fail-open que `DailyTurnsBudget` (`turns:day`), pero con un único tope
 *   para todos los planes (`INTERVIEWS_DAILY_CAP`) en vez de uno por plan.
 * - `INTERVIEWS_REQUIRE_PRO` es un interruptor para el día en que el
 *   simulador deje de ser gratis (FR-33); hoy vale `false` por defecto.
 */
@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly repository: InterviewsRepository,
    private readonly profiles: ProfilesRepository,
    private readonly redis: RedisService,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
    private readonly configService: ConfigService<Env, true>,
    private readonly i18n: I18nService,
  ) {}

  async getQuota(userId: string, now: Date = new Date()): Promise<InterviewQuotaDto> {
    const limit = this.configService.get('INTERVIEWS_DAILY_CAP', { infer: true });
    const requiresPro = this.configService.get('INTERVIEWS_REQUIRE_PRO', { infer: true });

    if (limit <= 0) {
      // 0 = tope desactivado (mismo criterio que `consumeDailyCap` y
      // TURNS_DAILY_CAP_*): `remaining: null` = sin límite.
      return { remaining: null, limit: 0, requiresPro, freeNotice: true };
    }

    const profile = await this.profiles.findByUserId(userId);
    const used = await this.peekDailyCount(userId, profile?.timezone ?? null, now);
    return { remaining: Math.max(0, limit - used), limit, requiresPro, freeNotice: true };
  }

  async create(
    userId: string,
    dto: CreateInterviewDto,
    acceptLanguage?: string,
    now: Date = new Date(),
  ): Promise<InterviewDto> {
    const profile = await this.profiles.findByUserId(userId);
    const locale = this.i18n.resolveLocale(profile?.locale, acceptLanguage);

    if (!this.configService.get('INTERVIEW_AGENT_URL', { infer: true })) {
      throw this.error('INTERVIEW_AGENT_UNAVAILABLE', locale);
    }

    const offer = this.normalizeOffer(dto, locale);

    // D8: antes de consumir el tope, calcular el hash o tocar el agente.
    if (offer.offerUrl !== null && isLinkedInHost(offer.offerUrl)) {
      throw this.error('OFFER_UNREADABLE', locale, { extra: { reason: 'linkedin' } });
    }

    // Perfil onboarded, igual que `POST /sessions` (SPEC-04 §3.1).
    if (profile === null || profile.onboarded_at === null) {
      throw this.error('NOT_ONBOARDED', locale);
    }

    // El plan se comprueba antes del tope: un rechazo por plan no consume cupo.
    const requiresPro = this.configService.get('INTERVIEWS_REQUIRE_PRO', { infer: true });
    if (requiresPro && effectivePlan(profile, now) === 'free') {
      throw this.error('PLAN_REQUIRED', locale);
    }

    const capKey = await this.consumeDailyCap(userId, profile.timezone, now, locale);

    let created: Interview | null = null;
    try {
      created = await this.repository.create({
        userId,
        type: dto.type,
        ...offer,
        offerHash: computeOfferHash(offer),
      });
      await this.jobs.enqueueInterviewPrepare(created.id);
    } catch (error) {
      // Si no llegó a prepararse, el intento no cuenta: se devuelve el cupo y,
      // si la fila ya existe, queda en `prep_failed` para que `/retry` sirva.
      if (capKey !== null) await this.redis.decrementIfPositive(capKey);
      if (created !== null) await this.markEnqueueFailed(userId, created.id);
      throw error;
    }

    return toInterviewDto(created);
  }

  async list(userId: string): Promise<InterviewListResultDto> {
    const rows = await this.repository.listByUser(userId);
    const cycles = await this.repository.listCycleProgress(
      userId,
      rows.map((row) => row.id),
    );
    return { items: rows.map((row) => toListItemDto(row, cycles.get(row.id) ?? null)) };
  }

  async detail(userId: string, id: string, acceptLanguage?: string): Promise<InterviewDetailDto> {
    const interview = SESSION_ID_RE.test(id) ? await this.repository.findById(userId, id) : null;
    if (interview === null) {
      throw this.error('NOT_FOUND', await this.localeFor(userId, acceptLanguage));
    }
    return toDetailDto(interview, this.estimatedMinutes());
  }

  /**
   * `POST /interviews/:id/retry`: desde `prep_failed` reencola la
   * preparación; desde `feedback_failed` (F12.3.T1) reencola el parecer. Sin
   * consumir tope (NFR-6).
   */
  async retry(userId: string, id: string, acceptLanguage?: string): Promise<InterviewDto> {
    if (!SESSION_ID_RE.test(id)) {
      throw this.error('NOT_FOUND', await this.localeFor(userId, acceptLanguage));
    }

    // Las transiciones atómicas van primero; `findById` solo decide 404 vs 409.
    const prepRetry = await this.repository.markRetrying(userId, id);
    if (prepRetry !== null) {
      try {
        await this.jobs.enqueueInterviewPrepare(prepRetry.id, { retry: true });
      } catch (error) {
        await this.markEnqueueFailed(userId, prepRetry.id);
        throw error;
      }
      return toInterviewDto(prepRetry);
    }

    const feedbackRetry = await this.repository.markFeedbackRetrying(userId, id);
    if (feedbackRetry !== null) {
      try {
        await this.jobs.enqueueInterviewFeedback(feedbackRetry.id, { retry: true });
      } catch (error) {
        await this.markEnqueueFeedbackFailed(userId, feedbackRetry.id);
        throw error;
      }
      return toInterviewDto(feedbackRetry);
    }

    const exists = (await this.repository.findById(userId, id)) !== null;
    throw this.error(
      exists ? 'INTERVIEW_NOT_RETRYABLE' : 'NOT_FOUND',
      await this.localeFor(userId, acceptLanguage),
    );
  }

  /**
   * `GET /interviews/:id/feedback` (F12.3.T1): el parecer en sus tres
   * estados — `200` listo, `202` todavía `feedback_pending`, `409 TOO_SHORT`
   * con `answeredCount` y `resumable` si la entrevista quedó corta. `feedback_failed` usa
   * el mismo código que un agente caído (`LLM_UNAVAILABLE`): no hay parecer
   * y la app ofrece reintentar, igual que cuando el agente no responde.
   */
  async feedback(userId: string, id: string, acceptLanguage?: string): Promise<InterviewFeedbackResult> {
    const interview = SESSION_ID_RE.test(id) ? await this.repository.findById(userId, id) : null;
    if (interview === null) {
      throw this.error('NOT_FOUND', await this.localeFor(userId, acceptLanguage));
    }

    switch (interview.status) {
      case 'feedback_ready':
        if (interview.feedback !== null) {
          return { statusCode: 200, body: toFeedbackDto(interview.feedback) };
        }
        // No debería ocurrir (el job solo marca `feedback_ready` junto con
        // `feedback`), pero sin dato no hay nada que devolver como listo.
        throw this.error('NOT_READY', await this.localeFor(userId, acceptLanguage));
      case 'feedback_pending':
        return { statusCode: 202, body: { status: 'feedback_pending' } };
      case 'too_short':
        throw this.error('TOO_SHORT', await this.localeFor(userId, acceptLanguage), {
          extra: { answeredCount: interview.answered_count, resumable: interview.resumable },
        });
      case 'feedback_failed':
        throw this.error('LLM_UNAVAILABLE', await this.localeFor(userId, acceptLanguage));
      default:
        // `preparing`/`prep_failed`/`ready`/`in_progress`: la entrevista
        // todavía no terminó, así que tampoco hay parecer que consultar.
        throw this.error('NOT_READY', await this.localeFor(userId, acceptLanguage));
    }
  }

  /** `ApiException` con el mensaje del catálogo i18n (es/pt-BR). */
  private error(code: ApiErrorCode, locale: Locale, options?: ApiExceptionOptions): ApiException {
    return ApiException.of(code, this.i18n.translate(code, locale), options);
  }

  /** Idioma de un error en rutas que no cargan el perfil de antemano. */
  private async localeFor(userId: string, acceptLanguage?: string): Promise<Locale> {
    const profile = await this.profiles.findByUserId(userId);
    return this.i18n.resolveLocale(profile?.locale, acceptLanguage);
  }

  /** Deja la entrevista en `prep_failed` sin tapar el error original. */
  private async markEnqueueFailed(userId: string, id: string): Promise<void> {
    try {
      await this.repository.markPrepFailed(userId, id, 'enqueue_failed');
    } catch (error) {
      this.logger.warn(
        `No se pudo marcar prep_failed la entrevista ${id}: ${(error as Error).message}`,
      );
    }
  }

  /** Igual que `markEnqueueFailed`, pero para el reintento del parecer. */
  private async markEnqueueFeedbackFailed(userId: string, id: string): Promise<void> {
    try {
      await this.repository.markFeedbackFailed(userId, id, 'enqueue_failed');
    } catch (error) {
      this.logger.warn(
        `No se pudo marcar feedback_failed la entrevista ${id}: ${(error as Error).message}`,
      );
    }
  }

  private estimatedMinutes(): number {
    return Math.ceil(this.configService.get('INTERVIEW_MAX_SEC', { infer: true }) / 60);
  }

  /**
   * I2: exactamente uno de `offerText`/`offerUrl` (mismo criterio que
   * `CreateSessionDto`). Devuelve la oferta normalizada (texto en blanco =
   * ausente), que cumple el CHECK `offer_text OR offer_url` y el
   * `PrepareRequest` de I1.
   */
  private normalizeOffer(dto: CreateInterviewDto, locale: Locale): Offer {
    const offerText = dto.offerText?.trim() ? dto.offerText : null;
    const offerUrl = dto.offerUrl?.trim() ? dto.offerUrl.trim() : null;
    if ((offerText === null) === (offerUrl === null)) {
      throw this.error('VALIDATION', locale, {
        extra: {
          details: [
            { field: 'offerText', reason: 'Debes mandar exactamente uno de offerText u offerUrl.' },
          ],
        },
      });
    }
    return { offerText, offerUrl };
  }

  /**
   * Tope diario (`interviews:day:{userId}:{userDay}`, mismo patrón que
   * `turns:day` de `DailyTurnsBudget`): contador Redis por día natural del
   * usuario, fail-open si Redis falla. `0` = sin tope. Devuelve la clave si
   * contó el intento (para devolver el cupo si luego falla), si no `null`.
   */
  private async consumeDailyCap(
    userId: string,
    timezone: string | null,
    now: Date,
    locale: Locale,
  ): Promise<string | null> {
    const limit = this.configService.get('INTERVIEWS_DAILY_CAP', { infer: true });
    if (limit <= 0) return null;

    const retryAfter = secondsUntilUserMidnight(timezone, now);
    const key = interviewsDayKey(userId, userDay(timezone, now));

    const used = await this.redis.increment(key, retryAfter);
    if (used === null) return null;
    if (used <= limit) return key;

    throw this.error('INTERVIEWS_DAILY_CAP', locale, { extra: { retryAfter } });
  }

  /** Lectura del contador sin incrementarlo, para `GET /interviews/quota`. */
  private async peekDailyCount(
    userId: string,
    timezone: string | null,
    now: Date,
  ): Promise<number> {
    const key = interviewsDayKey(userId, userDay(timezone, now));
    const raw = await this.redis.get(key);
    return raw === null ? 0 : Number(raw);
  }
}

/* ============================================================================
   Helpers puros
   ========================================================================== */

function interviewsDayKey(userId: string, day: string): string {
  return `interviews:day:${userId}:${day}`;
}

function isLinkedInHost(url: string): boolean {
  let hostname: string;
  try {
    // Sin el punto final del FQDN (`linkedin.com.` también es LinkedIn).
    hostname = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    // Formato inválido: @IsUrl del DTO ya lo habría rechazado con 400 antes
    // de llegar aquí. No es LinkedIn, así que se deja que siga su curso.
    return false;
  }
  return LINKEDIN_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function normalizeOfferText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Exactamente uno de los dos es no nulo (`normalizeOffer`). */
interface Offer {
  readonly offerText: string | null;
  readonly offerUrl: string | null;
}

/** sha256 del texto normalizado o de la URL tal cual (migración F10.1.T1). */
function computeOfferHash(offer: Offer): string {
  const basis = offer.offerText !== null ? normalizeOfferText(offer.offerText) : (offer.offerUrl ?? '');
  return createHash('sha256').update(basis).digest('hex');
}

function toInterviewDto(
  row: Pick<Interview, 'id' | 'type' | 'status' | 'prep_step' | 'created_at'>,
): InterviewDto {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    prepStep: row.prep_step,
    createdAt: row.created_at,
  };
}

function toDetailDto(row: Interview, estimatedMin: number): InterviewDetailDto {
  const competencies: InterviewCompetencyDto[] =
    row.plan?.rubric.map((competency) => ({ id: competency.id, name: competency.name })) ?? [];

  return {
    ...toInterviewDto(row),
    company: row.company,
    role: row.role,
    area: row.area,
    seniority: row.seniority,
    questionCount: row.plan?.questions.length ?? null,
    estimatedMin: row.plan !== null ? estimatedMin : null,
    competencies,
    errorCode: row.error_code,
    resumable: row.resumable,
  };
}

/**
 * `status` → estado de la pantalla de historial (FR-31). Los estados de
 * ciclo de estudio («Ciclo n de N», «Re-entrevista hecha») no se modelan
 * todavía: `study_cycles` existe desde F10.1.T1 pero este módulo no lo lee.
 *
 * ponytail: mapeo plano 1:1 hasta que F12 (ciclo de estudio) traiga esos
 * datos; subir de nivel cuando `GET /interviews` necesite reflejarlos.
 */
const HISTORY_STATUS: Readonly<Record<InterviewStatus, string>> = Object.freeze({
  preparing: 'preparing',
  prep_failed: 'prep_failed',
  ready: 'ready',
  in_progress: 'unfinished',
  too_short: 'unfinished',
  feedback_pending: 'feedback_pending',
  feedback_ready: 'feedback_ready',
  feedback_failed: 'feedback_failed',
});

/** `usage` es telemetría interna del agente (modelo, tokens): no sale de la API. */
function toFeedbackDto(feedback: InterviewFeedback): InterviewFeedbackDto {
  const { usage: _usage, ...rest } = feedback;
  return rest;
}

function toListItemDto(
  row: InterviewListRow,
  cycle: { status: StudyCycle['status']; doneCount: number } | null,
): InterviewListItemDto {
  return {
    ...toInterviewDto(row),
    company: row.company ? { name: row.company.name } : null,
    role: row.role,
    historyStatus: HISTORY_STATUS[row.status],
    resumable: row.resumable,
    isReinterview: row.parent_interview_id !== null,
    cycleCompletedSessions: cycle?.doneCount ?? null,
    cycleStatus: cycle?.status ?? null,
  };
}
