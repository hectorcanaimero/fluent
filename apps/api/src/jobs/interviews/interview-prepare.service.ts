/**
 * Job `interview-prepare` (cola `interviews`, F10.3.T3; arch 003 §Components
 * C1/C3, §Interfaces I1).
 *
 * Entrada: `{ interviewId }`. Pasos:
 *   1. Tomar el candado `interview:prepare:{id}`; si lo tiene otro job,
 *      salir (solo uno llama al agente).
 *   2. Cargar la entrevista; si no está `preparing`, salir (ya se procesó,
 *      incluido un reintento cuyo intento anterior ya guardó el plan).
 *   3. `prep_step = researching`, armar el `PrepareRequest` (oferta, nivel
 *      del perfil, últimas `previousQuestions`) y llamar al agente.
 *   4. `offer_unreadable` → `prep_failed`, `error_code`, se devuelve el
 *      consumo del tope diario y se avisa el fallo. No es un error: el
 *      agente respondió, solo que la oferta no se pudo leer.
 *   5. Éxito → uso en `llm_calls` (cada llamada al agente cuesta, aunque
 *      luego se reintente), las 8 preguntas (idempotente) y, al final, ficha
 *      + plan con `ready`/`done`: guardar el plan es el último paso, así que
 *      si un reintento ve `ready` ya no queda nada por hacer salvo el push.
 *
 * Si algo lanza, se propaga: BullMQ reintenta con el backoff de la cola
 * `interviews` (SPEC-05 §1, `attempts: 2`) salvo que `classifyPrepareError`
 * diga que reintentar no sirve (el `Processor` lo convierte en
 * `UnrecoverableError`). Al no quedar reintentos, el `Processor` llama a
 * `markFailedFinal` con el `error_code` real.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { InterviewPlan, PrepareRequest } from '../../interviews/interviews.types.js';
import {
  AgentInvalidResponseError,
  AgentUnavailableError,
  InterviewAgentClient,
} from '../../interviews/interview-agent.client.js';
import { PushService } from '../../push/push.service.js';
import {
  InterviewPrepareRepository,
  PREVIOUS_QUESTIONS_LIMIT,
  ProfileMissingError,
} from './interview-prepare.repository.js';

/** El agente no resolvió todavía una empresa cuando falla: no hay nombre que mostrar. */
const UNKNOWN_COMPANY_LABEL = 'esta oferta';

/** `error_code` de `prep_failed` cuando el job falla del todo. */
export type PrepareErrorCode =
  | 'agent_unavailable'
  | 'agent_invalid_response'
  | 'profile_missing'
  | 'internal';

/**
 * `error_code` real del fallo y si reintentar puede arreglarlo. Mira también
 * `cause`, porque el `Processor` envuelve los deterministas en
 * `UnrecoverableError`. Una respuesta inválida ya pasó la validación zod del
 * cliente: el mismo agente devolverá lo mismo, no se reintenta.
 */
export function classifyPrepareError(error: unknown): {
  readonly code: PrepareErrorCode;
  readonly retryable: boolean;
} {
  let e: unknown = error;
  while (e instanceof Error) {
    if (e instanceof AgentUnavailableError) return { code: 'agent_unavailable', retryable: true };
    if (e instanceof AgentInvalidResponseError) return { code: 'agent_invalid_response', retryable: false };
    if (e instanceof ProfileMissingError) return { code: 'profile_missing', retryable: false };
    e = e.cause;
  }
  return { code: 'internal', retryable: true };
}

export type InterviewPrepareStatus = 'ready' | 'offer_unreadable' | 'skipped';

export interface InterviewPrepareJobResult {
  readonly status: InterviewPrepareStatus;
  readonly reason?: 'interview_not_found' | 'not_preparing' | 'locked';
  readonly errorCode?: string;
}

@Injectable()
export class InterviewPrepareService {
  private readonly logger = new Logger(InterviewPrepareService.name);
  private readonly promptVersion: number;

  constructor(
    private readonly repository: InterviewPrepareRepository,
    private readonly agent: InterviewAgentClient,
    private readonly push: PushService,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = configService.get('PROMPT_VERSION', { infer: true });
  }

  /** `owner` identifica al job (su id de BullMQ) como dueño del candado. */
  async run(interviewId: string, attempt: number, owner: string): Promise<InterviewPrepareJobResult> {
    if (!(await this.repository.acquirePrepareLock(interviewId, owner))) {
      this.logger.warn(`Entrevista ${interviewId} ya la prepara otro job; se omite`);
      return { status: 'skipped', reason: 'locked' };
    }
    try {
      return await this.prepare(interviewId, attempt);
    } finally {
      await this.repository.releasePrepareLock(interviewId, owner);
    }
  }

  private async prepare(interviewId: string, attempt: number): Promise<InterviewPrepareJobResult> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview) {
      this.logger.warn(`Entrevista ${interviewId} inexistente; nada que hacer`);
      return { status: 'skipped', reason: 'interview_not_found' };
    }
    if (interview.status !== 'preparing') {
      return { status: 'skipped', reason: 'not_preparing' };
    }

    await this.repository.setPrepStep(interviewId, 'researching');

    // Re-entrevista (F13.1.T2, FR-19/FR-20): la rúbrica sale siempre de la
    // padre, no de la carga del job, para que `/retry` también la conserve.
    const [learnerLevel, previousQuestions, fixedRubric] = await Promise.all([
      this.repository.loadLearnerLevel(interview.user_id),
      this.repository.loadPreviousQuestions(interview, PREVIOUS_QUESTIONS_LIMIT),
      interview.parent_interview_id
        ? this.repository.loadParentRubric(interview.parent_interview_id)
        : null,
    ]);

    const request: PrepareRequest = {
      interviewId,
      type: interview.type,
      offerText: interview.offer_text,
      offerUrl: interview.offer_url,
      learnerLevel,
      previousQuestions,
      ...(fixedRubric ? { fixedRubric } : {}),
    };

    const startedAt = Date.now();
    // Si falla, se propaga para que BullMQ reintente (ver cabecera del
    // fichero); el `Processor` decide cuándo ya no quedan reintentos.
    const response = await this.agent.prepare(request);
    const latencyMs = Date.now() - startedAt;

    if (response.status === 'offer_unreadable') {
      await this.repository.markPrepFailed(interviewId, response.reason);
      await this.repository.refundDailyCap(interview.user_id, interview.created_at);
      await this.push.notifyInterviewPrepFailed(interview.user_id, interviewId, UNKNOWN_COMPANY_LABEL);
      return { status: 'offer_unreadable', errorCode: response.reason };
    }

    const plan: InterviewPlan = {
      type: response.type,
      company: response.company,
      role: response.role,
      area: response.area,
      seniority: response.seniority,
      stack: response.stack,
      rubric: response.rubric,
      questions: response.questions,
    };

    await this.repository.recordPrepareUsage({
      userId: interview.user_id,
      purpose: 'interview_prepare',
      model: response.usage.model,
      tokensIn: response.usage.inputTokens,
      tokensOut: response.usage.outputTokens,
      latencyMs,
      attempt,
      promptVersion: this.promptVersion,
    });

    await this.repository.insertQuestionsAsked(
      interview.user_id,
      interview.offer_hash,
      response.area,
      response.questions.map((question) => question.text),
    );

    // Último paso persistente: tras él, un reintento ve `ready` y no vuelve a
    // llamar al agente. `prep_step` pasa de `researching` a `done` directo.
    await this.repository.markReady(interviewId, {
      company: response.company,
      role: response.role,
      area: response.area,
      seniority: response.seniority,
      plan,
    });

    await this.push.notifyInterviewReady(
      interview.user_id,
      interviewId,
      response.role,
      response.company.name,
    );

    return { status: 'ready' };
  }

  /**
   * El `Processor` la llama cuando BullMQ agota los reintentos (MAL-20 de
   * `coaching-brief`, mismo patrón). `error del agente → ... prep_failed y
   * push de fallo, sin consumir tope` (F10.3.T3): el reembolso es el mismo
   * que en `offer_unreadable`, porque tampoco es un fallo del usuario.
   */
  async markFailedFinal(interviewId: string, errorCode: PrepareErrorCode): Promise<void> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview || interview.status !== 'preparing') return;

    await this.repository.markPrepFailed(interviewId, errorCode);
    await this.repository.refundDailyCap(interview.user_id, interview.created_at);
    await this.push.notifyInterviewPrepFailed(interview.user_id, interviewId, UNKNOWN_COMPANY_LABEL);
  }
}
