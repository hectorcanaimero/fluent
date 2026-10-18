/**
 * Procesador BullMQ de la cola `interviews` (F10.3.T3). Despacha por
 * `job.name`: `interview-prepare` e `interview-feedback` (F12.3.T1).
 * Concurrencia y reintentos: ver `jobs.constants.ts`
 * (`QUEUE_CONCURRENCY`/`QUEUE_DEFAULT_JOB_OPTIONS` de `QUEUE_INTERVIEWS`).
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';

import {
  JOB_INTERVIEW_FEEDBACK,
  JOB_INTERVIEW_PREPARE,
  QUEUE_CONCURRENCY,
  QUEUE_INTERVIEWS,
} from '../jobs.constants.js';
import {
  classifyFeedbackError,
  InterviewFeedbackService,
  type InterviewFeedbackJobResult,
} from './interview-feedback.service.js';
import {
  classifyPrepareError,
  InterviewPrepareService,
  type InterviewPrepareJobResult,
} from './interview-prepare.service.js';

/**
 * Carga de un job de la cola `interviews` (la encolan `POST /interviews`,
 * `POST /interviews/:id/retry` y `InterviewSessionService.onInterviewSessionClosed`).
 * `interview-prepare` e `interview-feedback` (F12.3.T1) comparten esta forma.
 */
export interface InterviewPrepareJobData {
  readonly interviewId: string;
}

@Processor(QUEUE_INTERVIEWS, { concurrency: QUEUE_CONCURRENCY[QUEUE_INTERVIEWS] })
export class InterviewPrepareProcessor extends WorkerHost {
  private readonly logger = new Logger(InterviewPrepareProcessor.name);

  constructor(
    private readonly service: InterviewPrepareService,
    private readonly feedbackService: InterviewFeedbackService,
  ) {
    super();
  }

  /** Errores de la propia conexión del `Worker` (Redis caído, por ejemplo). */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_INTERVIEWS}] ${error.message}`);
  }

  /**
   * Último fallo del job: cuando ya no quedan reintentos de BullMQ,
   * `prep_failed`/`feedback_failed` (arch 003 §Decisions: «error del agente →
   * 1 reintento con backoff; al agotarse, prep_failed»; F12.3.T1 extiende el
   * mismo criterio al parecer, sin push).
   *
   * BullMQ emite `failed` en **cada** intento, así que solo se actúa cuando
   * `attemptsMade` alcanza el total configurado para la cola o el error es
   * `UnrecoverableError` (BullMQ ya no reintenta).
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<InterviewPrepareJobData> | undefined, error?: Error): Promise<void> {
    if (job === undefined) return;

    const attempts = job.opts.attempts ?? 1;
    const unrecoverable = error?.name === 'UnrecoverableError';
    if (job.attemptsMade < attempts && !unrecoverable) return;

    if (job.name === JOB_INTERVIEW_PREPARE) {
      const { code } = classifyPrepareError(error);
      try {
        await this.service.markFailedFinal(job.data.interviewId, code);
        this.logger.warn(
          `[${QUEUE_INTERVIEWS}] entrevista ${job.data.interviewId} marcada 'prep_failed' (${code}) tras ${job.attemptsMade} intento(s)`,
        );
      } catch (error) {
        this.logger.error(
          `[${QUEUE_INTERVIEWS}] no se pudo marcar 'prep_failed' la entrevista ${job.data.interviewId}: ` +
            (error as Error).message,
        );
      }
      return;
    }

    if (job.name === JOB_INTERVIEW_FEEDBACK) {
      const { code } = classifyFeedbackError(error);
      try {
        await this.feedbackService.markFailedFinal(job.data.interviewId, code);
        this.logger.warn(
          `[${QUEUE_INTERVIEWS}] entrevista ${job.data.interviewId} marcada 'feedback_failed' (${code}) tras ${job.attemptsMade} intento(s)`,
        );
      } catch (error) {
        this.logger.error(
          `[${QUEUE_INTERVIEWS}] no se pudo marcar 'feedback_failed' la entrevista ${job.data.interviewId}: ` +
            (error as Error).message,
        );
      }
    }
  }

  async process(
    job: Job<InterviewPrepareJobData>,
  ): Promise<InterviewPrepareJobResult | InterviewFeedbackJobResult> {
    const startedAt = Date.now();
    try {
      const result = await this.runByName(job);
      this.logger.log(
        JSON.stringify({
          job: job.name,
          id: job.id,
          durationMs: Date.now() - startedAt,
          result,
        }),
      );
      return result;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          job: job.name,
          id: job.id,
          durationMs: Date.now() - startedAt,
          result: {
            status: 'failed',
            attempt: job.attemptsMade + 1,
            error: (error as Error).message,
          },
        }),
      );
      // Se propaga para que BullMQ reintente con el backoff de la cola, salvo
      // los fallos deterministas: reintentarlos solo gasta otra llamada.
      // `retryable` coincide en los dos clasificadores para los mismos tipos
      // de error, pero cada job usa el suyo para no acoplar sus `code`.
      const classify = job.name === JOB_INTERVIEW_FEEDBACK ? classifyFeedbackError : classifyPrepareError;
      if (!classify(error).retryable) {
        const unrecoverable = new UnrecoverableError((error as Error).message);
        unrecoverable.cause = error;
        throw unrecoverable;
      }
      throw error;
    }
  }

  private async runByName(
    job: Job<InterviewPrepareJobData>,
  ): Promise<InterviewPrepareJobResult | InterviewFeedbackJobResult> {
    switch (job.name) {
      case JOB_INTERVIEW_PREPARE:
        return this.service.run(job.data.interviewId, job.attemptsMade + 1, String(job.id));
      case JOB_INTERVIEW_FEEDBACK:
        return this.feedbackService.run(job.data.interviewId, job.attemptsMade + 1, String(job.id));
      default:
        throw new UnrecoverableError(`${QUEUE_INTERVIEWS}: job desconocido "${job.name}"`);
    }
  }
}
