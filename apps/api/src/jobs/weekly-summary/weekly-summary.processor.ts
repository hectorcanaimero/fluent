/**
 * Procesador BullMQ de la cola `social` (SPEC-05 §1 y §4).
 *
 * Un único `@Processor(QUEUE_SOCIAL)` que despacha por `job.name` en vez de
 * dos processors separados. BullMQ crea un `Worker` por cada `@Processor`, y
 * dos `Worker`s escuchando la misma cola competirían por **todos** los jobs
 * que entran en ella (BullMQ reparte por disponibilidad, no por nombre de
 * job): un job `weekly-summary-dispatch` podría acabar en el `Worker`
 * pensado para `weekly-summary`, y viceversa. Un único `Worker` con un
 * `switch` sobre `job.name` evita esa condición de carrera y además respeta
 * la concurrencia 1 de la cola `social` (SPEC-05 §1) sin tener que repartirla
 * entre dos `Worker`s. Documentado en pendientes/PR-05.md.
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  JOB_WEEKLY_SUMMARY,
  JOB_WEEKLY_SUMMARY_DISPATCH,
  QUEUE_CONCURRENCY,
  QUEUE_SOCIAL,
} from '../jobs.constants.js';
import type { WeeklySummaryJobData } from './weekly-summary-dispatch.service.js';
import {
  WeeklySummaryDispatchService,
  type WeeklySummaryDispatchResult,
} from './weekly-summary-dispatch.service.js';
import {
  WeeklySummaryService,
  type WeeklySummaryJobResult,
} from './weekly-summary.service.js';

type WeeklySummaryQueueResult = WeeklySummaryJobResult | WeeklySummaryDispatchResult;

@Processor(QUEUE_SOCIAL, { concurrency: QUEUE_CONCURRENCY[QUEUE_SOCIAL] })
export class WeeklySummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(WeeklySummaryProcessor.name);

  constructor(
    private readonly dispatchService: WeeklySummaryDispatchService,
    private readonly service: WeeklySummaryService,
  ) {
    super();
  }

  /**
   * Errores de la propia conexión del `Worker` (Redis caído, por ejemplo). Sin
   * este listener BullMQ los vuelca crudos por `console.error`. No son fallos
   * de un job: el worker sigue reintentando la conexión.
   */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_SOCIAL}] ${error.message}`);
  }

  async process(
    job: Job<WeeklySummaryJobData | Record<string, never>>,
  ): Promise<WeeklySummaryQueueResult> {
    const startedAt = Date.now();
    try {
      const result = await this.runByName(job);
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
      // Se propaga para que BullMQ reintente con el backoff de la cola `social`.
      throw error;
    }
  }

  private async runByName(
    job: Job<WeeklySummaryJobData | Record<string, never>>,
  ): Promise<WeeklySummaryQueueResult> {
    switch (job.name) {
      case JOB_WEEKLY_SUMMARY_DISPATCH:
        return this.dispatchService.run();
      case JOB_WEEKLY_SUMMARY: {
        const { groupId, weekStart } = job.data as WeeklySummaryJobData;
        return this.service.run(groupId, weekStart);
      }
      default:
        throw new Error(`weekly-summary: job desconocido "${job.name}"`);
    }
  }
}
