/**
 * Job `interview-feedback` (cola `interviews`, F10.3.T3; arch 003
 * §Components C3, §Interfaces I1; F12.3.T1).
 *
 * Entrada: `{ interviewId }`, encolado por
 * `InterviewSessionService.onInterviewSessionClosed` (F12.1.T2) cuando la
 * entrevista queda `feedback_pending`, o por `InterviewsService.retry` desde
 * `feedback_failed`. Pasos:
 *   1. Candado `interview:feedback:{id}`; si lo tiene otro job, salir.
 *   2. Cargar la entrevista; si no está `feedback_pending`, salir (ya se
 *      procesó, o un reintento concurrente ya la movió).
 *   3. Armar el `FeedbackRequest` de I1: `plan`, transcript con
 *      `questionIdx`, `englishErrors` (de `corrections`), `locale` y nombre
 *      del perfil, `previousFeedback` si hay `parent_interview_id`.
 *   4. Llamar al agente. Descartar las competencias cuya `evidence` no sea
 *      subcadena literal de alguna respuesta del candidato (defensa en
 *      profundidad: el agente ya reintenta y descarta por su cuenta, F12.2.T1,
 *      pero Nest es quien tiene el transcript real).
 *   5. Uso en `llm_calls`, guardar `feedback` (`feedback_ready`), memoria
 *      (D6) y push `notifyInterviewFeedbackReady`.
 *
 * Si algo lanza, se propaga para que BullMQ reintente (mismo criterio que
 * `interview-prepare`); al agotar los reintentos, el `Processor` llama a
 * `markFailedFinal`, que deja `feedback_failed` **sin** push (D2/D6: el
 * usuario no se entera de un parecer que nunca llegó a verse completo).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { RecurringError } from '../../db/schema.js';
import {
  AgentInvalidResponseError,
  AgentUnavailableError,
  InterviewAgentClient,
} from '../../interviews/interview-agent.client.js';
import type { FeedbackRequest, InterviewFeedback } from '../../interviews/interviews.types.js';
import { MemoryRepository } from '../../memory/memory.repository.js';
import { PushService } from '../../push/push.service.js';
import { ProfileMissingError } from './interview-prepare.repository.js';
import {
  type EnglishErrorRow,
  InterviewFeedbackRepository,
  type InterviewFeedbackRow,
  type TranscriptLineRow,
} from './interview-feedback.repository.js';

/** El agente no resolvió todavía una empresa cuando falla: no hay nombre que mostrar. */
const UNKNOWN_COMPANY_LABEL = 'esta oferta';

/** D6: «hecho pending ... ≤160 caracteres». */
const FACT_TEXT_MAX_LENGTH = 160;

/** `error_code` de `feedback_failed` cuando el job falla del todo. */
export type FeedbackErrorCode =
  | 'agent_unavailable'
  | 'agent_invalid_response'
  | 'profile_missing'
  | 'internal';

/** Mismo criterio que `classifyPrepareError` (`interview-prepare.service.ts`). */
export function classifyFeedbackError(error: unknown): {
  readonly code: FeedbackErrorCode;
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

export type InterviewFeedbackStatus = 'ready' | 'skipped';

export interface InterviewFeedbackJobResult {
  readonly status: InterviewFeedbackStatus;
  readonly reason?: 'interview_not_found' | 'not_pending' | 'locked';
}

@Injectable()
export class InterviewFeedbackService {
  private readonly logger = new Logger(InterviewFeedbackService.name);
  private readonly promptVersion: number;

  constructor(
    private readonly repository: InterviewFeedbackRepository,
    private readonly agent: InterviewAgentClient,
    private readonly memory: MemoryRepository,
    private readonly push: PushService,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = configService.get('PROMPT_VERSION', { infer: true });
  }

  /** `owner` identifica al job (su id de BullMQ) como dueño del candado. */
  async run(interviewId: string, attempt: number, owner: string): Promise<InterviewFeedbackJobResult> {
    if (!(await this.repository.acquireFeedbackLock(interviewId, owner))) {
      this.logger.warn(`Entrevista ${interviewId}: ya se está armando otro parecer; se omite`);
      return { status: 'skipped', reason: 'locked' };
    }
    try {
      return await this.buildFeedback(interviewId, attempt);
    } finally {
      await this.repository.releaseFeedbackLock(interviewId, owner);
    }
  }

  private async buildFeedback(interviewId: string, attempt: number): Promise<InterviewFeedbackJobResult> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview) {
      this.logger.warn(`Entrevista ${interviewId} inexistente; nada que hacer`);
      return { status: 'skipped', reason: 'interview_not_found' };
    }
    if (interview.status !== 'feedback_pending' || interview.plan === null) {
      return { status: 'skipped', reason: 'not_pending' };
    }

    const profile = await this.repository.loadProfile(interview.user_id);
    if (profile === null) {
      throw new ProfileMissingError(`El usuario ${interview.user_id} no tiene perfil`);
    }

    const [session, parentFeedback] = await Promise.all([
      this.repository.loadSessionData(interview.user_id, interviewId),
      interview.parent_interview_id
        ? this.repository.loadParentFeedback(interview.parent_interview_id)
        : Promise.resolve(null),
    ]);
    const englishErrorRows = await this.repository.loadEnglishErrors(session.sessionIds);

    const request: FeedbackRequest = {
      interviewId,
      locale: profile.locale,
      learnerName: profile.display_name,
      plan: interview.plan,
      transcript: session.transcript.map((line) => toTranscriptLine(line)),
      englishErrors: englishErrorRows.map((row) => ({
        original: row.original,
        corrected: row.corrected,
        category: row.category,
      })),
      previousFeedback: parentFeedback,
    };

    const startedAt = Date.now();
    // Si falla, se propaga para que BullMQ reintente (ver cabecera del
    // fichero); el `Processor` decide cuándo ya no quedan reintentos.
    const response = await this.agent.feedback(request);
    const latencyMs = Date.now() - startedAt;

    const candidateAnswers = session.transcript
      .filter((line) => line.role === 'user')
      .map((line) => line.text);
    const competencies = response.competencies.filter((competency) =>
      candidateAnswers.some((answer) => answer.includes(competency.evidence)),
    );
    const feedback: InterviewFeedback = { ...response, competencies };

    await this.repository.recordFeedbackUsage({
      userId: interview.user_id,
      purpose: 'interview_feedback',
      model: response.usage.model,
      tokensIn: response.usage.inputTokens,
      tokensOut: response.usage.outputTokens,
      latencyMs,
      attempt,
      promptVersion: this.promptVersion,
    });

    // Último paso persistente: tras él, un reintento ve `feedback_ready` y
    // no vuelve a llamar al agente.
    await this.repository.saveFeedback(interviewId, feedback);

    await this.writeMemory(interview, feedback, englishErrorRows);

    await this.push.notifyInterviewFeedbackReady(
      interview.user_id,
      interviewId,
      interview.company?.name ?? UNKNOWN_COMPANY_LABEL,
    );

    return { status: 'ready' };
  }

  /**
   * D6: un hecho `pending` de preparación de entrevista (sin duplicar para
   * la misma oferta) y los errores de inglés del parecer sumados a
   * `recurring_errors` del brief (máx. 5, sin duplicar). Por el repositorio
   * de memoria, no por `MemoryService` (esa capa valida reglas de los
   * endpoints de `GET/PATCH/PUT /memory`, que no aplican aquí).
   */
  private async writeMemory(
    interview: InterviewFeedbackRow,
    feedback: InterviewFeedback,
    englishErrorRows: readonly EnglishErrorRow[],
  ): Promise<void> {
    if (interview.role && interview.company) {
      const text = `Se prepara para una entrevista de ${interview.role} en ${interview.company.name}`.slice(
        0,
        FACT_TEXT_MAX_LENGTH,
      );
      await this.memory.addPendingFactIfNew(interview.user_id, text, null);
    }

    const recurringErrors = feedback.english.errors.map((error) =>
      toRecurringError(error, englishErrorRows),
    );
    await this.memory.addRecurringErrors(interview.user_id, recurringErrors);
  }

  /**
   * El `Processor` la llama cuando BullMQ agota los reintentos. `feedback_failed`
   * sin push (a diferencia de `prep_failed`): no hay nada que "reembolsar" —
   * el parecer no consume el tope diario de entrevistas — y la app lo
   * descubre al consultar `GET /interviews/:id/feedback` u ofrecer
   * `POST /interviews/:id/retry`.
   */
  async markFailedFinal(interviewId: string, errorCode: FeedbackErrorCode): Promise<void> {
    const interview = await this.repository.loadInterview(interviewId);
    if (!interview || interview.status !== 'feedback_pending') return;
    await this.repository.markFeedbackFailed(interviewId, errorCode);
  }
}

function toTranscriptLine(line: TranscriptLineRow): FeedbackRequest['transcript'][number] {
  return {
    role: line.role === 'tutor' ? 'interviewer' : 'candidate',
    questionIdx: line.question_idx ?? 1,
    text: line.text,
  };
}

/**
 * El parecer no repite `category` (I1 `EnglishErrorOut`: solo
 * `original`/`corrected`/`explanation`); se recupera de la corrección de
 * entrada con el mismo `original` literal, o `'other'` si el agente
 * reformuló el texto.
 */
function toRecurringError(
  error: InterviewFeedback['english']['errors'][number],
  inputs: readonly EnglishErrorRow[],
): RecurringError {
  const match = inputs.find((input) => input.original === error.original);
  return { category: match?.category ?? 'other', example: error.original.slice(0, 200) };
}
