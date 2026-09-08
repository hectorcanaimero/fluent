/**
 * Procesador BullMQ de la cola `brief` (SPEC-05 §1 y §2).
 *
 * Concurrencia 3, tal y como fija la tabla de SPEC-05 §1 (es una opción del
 * `Worker`, no de la cola). Los reintentos y el backoff exponencial de 30 s
 * viven en los `defaultJobOptions` de la cola (`jobs.constants.ts`).
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { CoachingBriefJobData } from '../job-dispatcher.js';
import { QUEUE_BRIEF, QUEUE_CONCURRENCY } from '../jobs.constants.js';
import {
  CoachingBriefService,
  type CoachingBriefJobResult,
} from './coaching-brief.service.js';

@Processor(QUEUE_BRIEF, { concurrency: QUEUE_CONCURRENCY[QUEUE_BRIEF] })
export class CoachingBriefProcessor extends WorkerHost {
  private readonly logger = new Logger(CoachingBriefProcessor.name);

  constructor(private readonly service: CoachingBriefService) {
    super();
  }

  /**
   * Errores de la propia conexión del `Worker` (Redis caído, por ejemplo). Sin
   * este listener BullMQ los vuelca crudos por `console.error`. No son fallos
   * de un job: el worker sigue reintentando la conexión.
   */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_BRIEF}] ${error.message}`);
  }

  async process(
    job: Job<CoachingBriefJobData>,
  ): Promise<CoachingBriefJobResult> {
    const startedAt = Date.now();
    try {
      const result = await this.service.run(job.data.sessionId);
      // SPEC-05 §9: cada job loguea `{ job, id, durationMs, result }` en JSON.
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
