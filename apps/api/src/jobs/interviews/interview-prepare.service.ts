/**
 * Job `interview-prepare` (cola `interviews`, F10.3.T3; arch 003 §Components
 * C1/C3, §Interfaces I1).
 *
 * Entrada: `{ interviewId }`. Pasos:
 *   1. Cargar la entrevista; si no está `preparing`, salir (ya se procesó o
 *      la encoló dos veces).
 *   2. `prep_step = researching`, armar el `PrepareRequest` (oferta, nivel
 *      del perfil, últimas `previousQuestions`) y llamar al agente.
 *   3. `prep_step = designing` al volver la llamada.
 *   4. `offer_unreadable` → `prep_failed`, `error_code`, se devuelve el
 *      consumo del tope diario y se avisa el fallo. No es un error: el
 *      agente respondió, solo que la oferta no se pudo leer.
 *   5. Éxito → guardar ficha + plan, `ready`/`done`, registrar las 8
 *      preguntas y el uso en `llm_calls`, avisar que está lista.
 *
 * Si `agent.prepare()` lanza (`AgentUnavailableError` o
 * `AgentInvalidResponseError`), se deja propagar para que BullMQ reintente
 * con el backoff de la cola `interviews` (SPEC-05 §1, `attempts: 2`). Cuando
 * el `Processor` agota los reintentos llama a `markFailedFinal`, que es la
 * contraparte de `markFailed` en `coaching-brief`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { InterviewPlan, PrepareRequest } from '../../interviews/interviews.types.js';
import { InterviewAgentClient } from '../../interviews/interview-agent.client.js';
import { PushService } from '../../push/push.service.js';
import {
  InterviewPrepareRepository,
  PREVIOUS_QUESTIONS_LIMIT,
} from './interview-prepare.repository.js';

/** El agente no resolvió todavía una empresa cuando falla: no hay nombre que mostrar. */
const UNKNOWN_COMPANY_LABEL = 'esta oferta';

/** `error_code` cuando el agente no respondió tras agotar los reintentos de BullMQ. */
export const AGENT_UNAVAILABLE_ERROR_CODE = 'agent_unavailable';

export type InterviewPrepareStatus = 'ready' | 'offer_unreadable' | 'skipped';

export interface InterviewPrepareJobResult {
  readonly status: InterviewPrepareStatus;
  readonly reason?: 'interview_not_found' | 'not_preparing';
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

  async run(interviewId: string, attempt: number): Promise<InterviewPrepareJobResult> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview) {
      this.logger.warn(`Entrevista ${interviewId} inexistente; nada que hacer`);
      return { status: 'skipped', reason: 'interview_not_found' };
    }
    if (interview.status !== 'preparing') {
      return { status: 'skipped', reason: 'not_preparing' };
    }

    await this.repository.setPrepStep(interviewId, 'researching');

    const [learnerLevel, previousQuestions] = await Promise.all([
      this.repository.loadLearnerLevel(interview.user_id),
      this.repository.loadPreviousQuestions(interview, PREVIOUS_QUESTIONS_LIMIT),
    ]);

    const request: PrepareRequest = {
      interviewId,
      type: interview.type,
      offerText: interview.offer_text,
      offerUrl: interview.offer_url,
      learnerLevel,
      previousQuestions,
    };

    const startedAt = Date.now();
    // Si falla, se propaga para que BullMQ reintente (ver cabecera del
    // fichero); el `Processor` decide cuándo ya no quedan reintentos.
    const response = await this.agent.prepare(request);
    const latencyMs = Date.now() - startedAt;

    await this.repository.setPrepStep(interviewId, 'designing');

    if (response.status === 'offer_unreadable') {
      await this.repository.markPrepFailed(interviewId, response.reason);
      await this.repository.refundDailyCap(interview.user_id);
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
  async markFailedFinal(interviewId: string): Promise<void> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview || interview.status !== 'preparing') return;

    await this.repository.markPrepFailed(interviewId, AGENT_UNAVAILABLE_ERROR_CODE);
    await this.repository.refundDailyCap(interview.user_id);
    await this.push.notifyInterviewPrepFailed(interview.user_id, interviewId, UNKNOWN_COMPANY_LABEL);
  }
}
