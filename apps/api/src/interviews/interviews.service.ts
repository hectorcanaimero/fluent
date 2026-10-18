import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Interview } from '../db/schema.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import { effectivePlan } from '../profiles/plan.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { RedisService } from '../redis/redis.service.js';
import { secondsUntilUserMidnight, userDay } from '../sessions/user-day.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewsRepository } from './interviews.repository.js';
import type { InterviewStatus, InterviewType, PrepStep, SeniorityLevel } from './interviews.types.js';

const AGENT_UNAVAILABLE_MESSAGE =
  'El simulador de entrevistas no está disponible en este momento.';
const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';
const OFFER_UNREADABLE_MESSAGE =
  'No pudimos leer esa oferta de LinkedIn. Copia el texto y pégalo en vez del enlace.';
const INTERVIEWS_DAILY_CAP_MESSAGE =
  'Por hoy usaste tus entrevistas. Mañana tenés más.';
const PLAN_REQUIRED_MESSAGE = 'El simulador de entrevistas requiere el plan Pro.';
const NOT_FOUND_MESSAGE = 'No encontramos esa entrevista.';
const NOT_RETRYABLE_MESSAGE =
  'Solo se puede reintentar una entrevista cuya preparación falló.';

/** Hosts de LinkedIn que `interview-agent` tampoco puede leer (D8). */
const LINKEDIN_HOSTS = ['linkedin.com', 'lnkd.in'];

/* ============================================================================
   DTOs de salida (I2)
   ========================================================================== */

export interface InterviewQuotaDto {
  readonly remaining: number;
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
}

export interface InterviewListItemDto extends InterviewDto {
  readonly company: { name: string } | null;
  readonly role: string | null;
  readonly historyStatus: string;
}

export interface InterviewListResultDto {
  readonly items: readonly InterviewListItemDto[];
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
  constructor(
    private readonly repository: InterviewsRepository,
    private readonly profiles: ProfilesRepository,
    private readonly redis: RedisService,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async getQuota(userId: string, now: Date = new Date()): Promise<InterviewQuotaDto> {
    const limit = this.configService.get('INTERVIEWS_DAILY_CAP', { infer: true });
    const requiresPro = this.configService.get('INTERVIEWS_REQUIRE_PRO', { infer: true });

    if (limit <= 0) {
      // ponytail: 0 = tope desactivado (mismo criterio que TURNS_DAILY_CAP_*);
      // se informa tal cual, no hay "ilimitado" en el contrato de I2.
      return { remaining: limit, limit, requiresPro, freeNotice: true };
    }

    const profile = await this.profiles.findByUserId(userId);
    const used = await this.peekDailyCount(userId, profile?.timezone ?? null, now);
    return { remaining: Math.max(0, limit - used), limit, requiresPro, freeNotice: true };
  }

  async create(
    userId: string,
    dto: CreateInterviewDto,
    now: Date = new Date(),
  ): Promise<InterviewDto> {
    if (!this.configService.get('INTERVIEW_AGENT_URL', { infer: true })) {
      throw ApiException.of('INTERVIEW_AGENT_UNAVAILABLE', AGENT_UNAVAILABLE_MESSAGE);
    }

    this.assertExactlyOneOffer(dto);

    // D8: antes de consumir el tope, calcular el hash o tocar el agente.
    if (dto.offerUrl !== undefined && isLinkedInHost(dto.offerUrl)) {
      throw ApiException.of('OFFER_UNREADABLE', OFFER_UNREADABLE_MESSAGE, {
        extra: { reason: 'linkedin' },
      });
    }

    const profile = await this.profiles.findByUserId(userId);

    await this.consumeDailyCap(userId, profile?.timezone ?? null, now);

    const requiresPro = this.configService.get('INTERVIEWS_REQUIRE_PRO', { infer: true });
    if (requiresPro && (profile === null || effectivePlan(profile, now) === 'free')) {
      throw ApiException.of('PLAN_REQUIRED', PLAN_REQUIRED_MESSAGE);
    }

    const created = await this.repository.create({
      userId,
      type: dto.type,
      offerText: dto.offerText ?? null,
      offerUrl: dto.offerUrl ?? null,
      offerHash: computeOfferHash(dto),
    });

    await this.jobs.enqueueInterviewPrepare(created.id);

    return toInterviewDto(created);
  }

  async list(userId: string): Promise<InterviewListResultDto> {
    const rows = await this.repository.listByUser(userId);
    return { items: rows.map(toListItemDto) };
  }

  async detail(userId: string, id: string): Promise<InterviewDetailDto> {
    const interview = await this.repository.findById(userId, id);
    if (interview === null) {
      throw ApiException.of('NOT_FOUND', NOT_FOUND_MESSAGE);
    }
    return toDetailDto(interview, this.estimatedMinutes());
  }

  /** `POST /interviews/:id/retry`: solo desde `prep_failed`, sin consumir tope (NFR-6). */
  async retry(userId: string, id: string): Promise<InterviewDto> {
    const interview = await this.repository.findById(userId, id);
    if (interview === null) {
      throw ApiException.of('NOT_FOUND', NOT_FOUND_MESSAGE);
    }
    if (interview.status !== 'prep_failed') {
      throw ApiException.of('INTERVIEW_NOT_RETRYABLE', NOT_RETRYABLE_MESSAGE);
    }

    const updated = await this.repository.markRetrying(userId, id);
    if (updated === null) {
      // Reintento concurrente: alguien más ya la movió fuera de prep_failed.
      throw ApiException.of('INTERVIEW_NOT_RETRYABLE', NOT_RETRYABLE_MESSAGE);
    }

    await this.jobs.enqueueInterviewPrepare(updated.id);
    return toInterviewDto(updated);
  }

  private estimatedMinutes(): number {
    return Math.ceil(this.configService.get('INTERVIEW_MAX_SEC', { infer: true }) / 60);
  }

  /** I2: exactamente uno de `offerText`/`offerUrl` (mismo criterio que `CreateSessionDto`). */
  private assertExactlyOneOffer(dto: CreateInterviewDto): void {
    const hasText = typeof dto.offerText === 'string' && dto.offerText.trim() !== '';
    const hasUrl = typeof dto.offerUrl === 'string' && dto.offerUrl.trim() !== '';
    if (hasText === hasUrl) {
      throw ApiException.of('VALIDATION', VALIDATION_MESSAGE, {
        extra: {
          details: [
            { field: 'offerText', reason: 'Debes mandar exactamente uno de offerText u offerUrl.' },
          ],
        },
      });
    }
  }

  /**
   * Tope diario (`interviews:day:{userId}:{userDay}`, mismo patrón que
   * `turns:day` de `DailyTurnsBudget`): contador Redis por día natural del
   * usuario, fail-open si Redis falla.
   */
  private async consumeDailyCap(
    userId: string,
    timezone: string | null,
    now: Date,
  ): Promise<void> {
    const limit = this.configService.get('INTERVIEWS_DAILY_CAP', { infer: true });
    if (limit <= 0) return;

    const retryAfter = secondsUntilUserMidnight(timezone, now);
    const key = interviewsDayKey(userId, userDay(timezone, now));

    const used = await this.redis.increment(key, retryAfter);
    if (used === null || used <= limit) return;

    throw ApiException.of('INTERVIEWS_DAILY_CAP', INTERVIEWS_DAILY_CAP_MESSAGE, {
      extra: { retryAfter },
    });
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
    hostname = new URL(url).hostname.toLowerCase();
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

/** sha256 del texto normalizado o de la URL tal cual (migración F10.1.T1). */
function computeOfferHash(dto: Pick<CreateInterviewDto, 'offerText' | 'offerUrl'>): string {
  const basis =
    dto.offerText !== undefined ? normalizeOfferText(dto.offerText) : (dto.offerUrl ?? '').trim();
  return createHash('sha256').update(basis).digest('hex');
}

function toInterviewDto(row: Interview): InterviewDto {
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

function toListItemDto(row: Interview): InterviewListItemDto {
  return {
    ...toInterviewDto(row),
    company: row.company ? { name: row.company.name } : null,
    role: row.role,
    historyStatus: HISTORY_STATUS[row.status],
  };
}
