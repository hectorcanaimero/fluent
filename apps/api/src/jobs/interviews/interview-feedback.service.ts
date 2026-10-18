/**
 * Job `interview-feedback` (cola `interviews`, F10.3.T3; arch 003
 * §Components C3, §Interfaces I1; F12.3.T1).
 *
 * Entrada: `{ interviewId }`, encolado por
 * `InterviewCloserService.onInterviewSessionClosed` (F12.1.T2) cuando la
 * entrevista queda `feedback_pending`, o por `InterviewsService.retry` desde
 * `feedback_failed`. Pasos:
 *   1. Candado `interview:feedback:{id}`; si lo tiene otro job, salir.
 *   2. Cargar la entrevista; si no está `feedback_pending`, salir (ya se
 *      procesó, o un reintento concurrente ya la movió). `feedback_pending`
 *      sin `plan` no tiene arreglo: `feedback_failed` con `invalid_state`.
 *   3. Armar el `FeedbackRequest` de I1: `plan`, transcript con
 *      `questionIdx`, `englishErrors` (de `corrections`), `locale` y nombre
 *      del perfil, `previousFeedback` si hay `parent_interview_id`.
 *   4. Llamar al agente. Descartar las competencias cuya `evidence` no sea
 *      cita literal (normalizada, ≥20 caracteres y 4 palabras) de alguna respuesta del candidato (defensa en
 *      profundidad: el agente ya reintenta y descarta por su cuenta, F12.2.T1,
 *      pero Nest es quien tiene el transcript real).
 *   5. Uso en `llm_calls` y la respuesta en caché (Redis, 1 h): si después
 *      falla la memoria o `feedback_ready`, el reintento reusa la respuesta
 *      sin volver a llamar al agente ni registrar el uso otra vez.
 *   6. Memoria (D6), `feedback_ready` (última escritura) y push
 *      `notifyInterviewFeedbackReady`.
 *
 * Si algo lanza, se propaga para que BullMQ reintente (mismo criterio que
 * `interview-prepare`); al agotar los reintentos, el `Processor` llama a
 * `markFailedFinal`, que deja `feedback_failed` **sin** push (D2/D6: el
 * usuario no se entera de un parecer que nunca llegó a verse completo).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { Locale, RecurringError } from '../../db/schema.js';
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

/** Sin empresa resuelta por el agente no hay nombre que mostrar (por `locale` del perfil). */
const UNKNOWN_COMPANY_LABEL: Readonly<Record<Locale, string>> = {
  es: 'esta oferta',
  'pt-BR': 'esta vaga',
};

/** Hecho `pending` de D6 (≤160 caracteres, lo recorta `addPendingFactIfNew`). */
function interviewFactText(locale: Locale, role: string, company: string): string {
  return locale === 'pt-BR'
    ? `Está se preparando para uma entrevista de ${role} na ${company}`
    : `Se prepara para una entrevista de ${role} en ${company}`;
}

/** `error_code` de `feedback_failed` cuando el job falla del todo. */
export type FeedbackErrorCode =
  | 'agent_unavailable'
  | 'agent_invalid_response'
  | 'profile_missing'
  | 'invalid_state'
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
  readonly reason?: 'interview_not_found' | 'not_pending' | 'locked' | 'invalid_state';
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
    if (interview.status !== 'feedback_pending') {
      return { status: 'skipped', reason: 'not_pending' };
    }
    if (interview.plan === null) {
      // Sin plan no hay parecer posible: reintentar no lo arregla, y
      // saltarla en silencio la dejaría `feedback_pending` para siempre.
      this.logger.error(`Entrevista ${interviewId} feedback_pending sin plan; feedback_failed`);
      await this.repository.markFeedbackFailed(interviewId, 'invalid_state' satisfies FeedbackErrorCode);
      return { status: 'skipped', reason: 'invalid_state' };
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
    const englishErrorRows = await this.repository.loadEnglishErrors(session.sessionId);

    const request: FeedbackRequest = {
      interviewId,
      locale: profile.locale,
      learnerName: profile.display_name,
      plan: interview.plan,
      transcript: toTranscript(session.transcript),
      englishErrors: englishErrorRows.map((row) => ({
        original: row.original,
        corrected: row.corrected,
        category: row.category,
      })),
      previousFeedback: parentFeedback,
    };

    const feedback =
      (await this.repository.loadCachedAgentFeedback(interviewId)) ??
      (await this.callAgent(interview.user_id, request, session.transcript, attempt));

    // Memoria antes del cambio de estado: si falla, el reintento la repite
    // (deduplica) en vez de perderla tras un `feedback_ready` ya escrito.
    await this.writeMemory(interview, profile.locale, feedback, englishErrorRows);

    // Última escritura: tras ella, un reintento ve `feedback_ready` y no
    // vuelve a llamar al agente.
    await this.repository.markFeedbackReady(interviewId, feedback);

    await this.push.notifyInterviewFeedbackReady(
      interview.user_id,
      interviewId,
      interview.company?.name ?? UNKNOWN_COMPANY_LABEL[profile.locale],
    );

    return { status: 'ready' };
  }

  /**
   * Llama al agente, filtra la evidencia, registra el uso y guarda la
   * respuesta en caché, en ese orden: así cada llamada real al agente queda
   * registrada exactamente una vez y un reintento no la repite.
   */
  private async callAgent(
    userId: string,
    request: FeedbackRequest,
    transcript: readonly TranscriptLineRow[],
    attempt: number,
  ): Promise<InterviewFeedback> {
    const startedAt = Date.now();
    // Si falla, se propaga para que BullMQ reintente (ver cabecera del
    // fichero); el `Processor` decide cuándo ya no quedan reintentos.
    const response = await this.agent.feedback(request);
    const latencyMs = Date.now() - startedAt;

    const candidateAnswers = transcript
      .filter((line) => line.role === 'user')
      .map((line) => normalize(line.text));
    const competencies = response.competencies.filter((competency) =>
      quotedInNormalized(competency.evidence, candidateAnswers),
    );
    const feedback: InterviewFeedback = { ...response, competencies };

    await this.repository.recordFeedbackUsage({
      userId,
      purpose: 'interview_feedback',
      model: response.usage.model,
      tokensIn: response.usage.inputTokens,
      tokensOut: response.usage.outputTokens,
      latencyMs,
      attempt,
      promptVersion: this.promptVersion,
    });
    await this.repository.cacheAgentFeedback(request.interviewId, feedback);
    return feedback;
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
    locale: Locale,
    feedback: InterviewFeedback,
    englishErrorRows: readonly EnglishErrorRow[],
  ): Promise<void> {
    if (interview.role && interview.company) {
      // `addPendingFactIfNew` recorta a 160 caracteres y deduplica.
      await this.memory.addPendingFactIfNew(
        interview.user_id,
        interviewFactText(locale, interview.role, interview.company.name),
        null,
      );
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
    // Solo transiciona desde `feedback_pending` (filtro en el UPDATE).
    await this.repository.markFeedbackFailed(interviewId, errorCode);
  }
}

/**
 * Solo los turnos del tutor llevan `question_idx` (`record_turn`); la
 * respuesta del candidato y el cierre (sin etiqueta) heredan la última
 * pregunta etiquetada.
 */
export function toTranscript(
  lines: readonly TranscriptLineRow[],
): FeedbackRequest['transcript'] {
  let questionIdx = 1;
  return lines.map((line) => {
    if (line.role === 'tutor' && line.question_idx !== null) questionIdx = line.question_idx;
    return {
      role: line.role === 'tutor' ? 'interviewer' : 'candidate',
      questionIdx,
      text: line.text,
    };
  });
}

/** Mismas reglas que `quoted_in` del agente (`app/feedback/evaluator.py`). */
const MIN_EVIDENCE_CHARS = 20;
const MIN_EVIDENCE_WORDS = 4;
const QUOTE_CHARS = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/gu;

function normalize(text: string): string {
  return text.toLowerCase().split(/\s+/u).filter(Boolean).join(' ');
}

/**
 * Cita literal (sin mayúsculas ni espacios extra) de una respuesta del
 * candidato: de al menos 20 caracteres y 4 palabras, o la respuesta entera.
 */
export function quotedIn(evidence: string, answers: readonly string[]): boolean {
  return quotedInNormalized(evidence, answers.map(normalize));
}

/** `quotedIn` con las respuestas ya normalizadas (una vez por parecer, no por competencia). */
function quotedInNormalized(evidence: string, normalizedAnswers: readonly string[]): boolean {
  const quote = normalize(evidence.replace(QUOTE_CHARS, ''));
  if (quote === '') return false;
  const longEnough =
    quote.length >= MIN_EVIDENCE_CHARS && quote.split(' ').length >= MIN_EVIDENCE_WORDS;
  return normalizedAnswers.some((line) => quote === line || (longEnough && line.includes(quote)));
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
