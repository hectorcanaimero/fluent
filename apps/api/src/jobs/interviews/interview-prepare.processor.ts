/**
 * Procesador BullMQ de la cola `interviews`, job `interview-prepare`
 * (F10.3.T3). Concurrencia y reintentos: ver `jobs.constants.ts`
 * (`QUEUE_CONCURRENCY`/`QUEUE_DEFAULT_JOB_OPTIONS` de `QUEUE_INTERVIEWS`).
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUE_CONCURRENCY, QUEUE_INTERVIEWS } from '../jobs.constants.js';
import {
  InterviewPrepareService,
  type InterviewPrepareJobResult,
} from './interview-prepare.service.js';

/** Carga del job (la encola `POST /interviews` y `POST /interviews/:id/retry`, F10.3.T2). */
export interface InterviewPrepareJobData {
  readonly interviewId: string;
}

@Processor(QUEUE_INTERVIEWS, { concurrency: QUEUE_CONCURRENCY[QUEUE_INTERVIEWS] })
export class InterviewPrepareProcessor extends WorkerHost {
  private readonly logger = new Logger(InterviewPrepareProcessor.name);

  constructor(private readonly service: InterviewPrepareService) {
    super();
  }

  /** Errores de la propia conexión del `Worker` (Redis caído, por ejemplo). */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_INTERVIEWS}] ${error.message}`);
  }

  /**
   * Último fallo del job: cuando ya no quedan reintentos de BullMQ,
   * `prep_failed` + push + reembolso del tope (arch 003 §Decisions: «error
   * del agente → 1 reintento con backoff; al agotarse, prep_failed»).
   *
   * BullMQ emite `failed` en **cada** intento, así que solo se actúa cuando
   * `attemptsMade` alcanza el total configurado para la cola.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<InterviewPrepareJobData> | undefined): Promise<void> {
    if (job === undefined) return;

    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) return;

    try {
      await this.service.markFailedFinal(job.data.interviewId);
      this.logger.warn(
        `[${QUEUE_INTERVIEWS}] entrevista ${job.data.interviewId} marcada 'prep_failed' tras ${attempts} intento(s)`,
      );
    } catch (error) {
      this.logger.error(
        `[${QUEUE_INTERVIEWS}] no se pudo marcar 'prep_failed' la entrevista ${job.data.interviewId}: ` +
          (error as Error).message,
      );
    }
  }

  async process(job: Job<InterviewPrepareJobData>): Promise<InterviewPrepareJobResult> {
    const startedAt = Date.now();
    try {
      const result = await this.service.run(job.data.interviewId, job.attemptsMade + 1);
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
      // Se propaga para que BullMQ reintente con el backoff de la cola.
      throw error;
    }
  }
}
