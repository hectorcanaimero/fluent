/**
 * Procesador BullMQ de la cola `maintenance` (SPEC-05 §1 y §5 a §8).
 *
 * Un único `@Processor(QUEUE_MAINTENANCE, { concurrency: 1 })` que despacha
 * por `job.name` en vez de 4 processors separados: mismo motivo que
 * `weekly-summary.processor.ts` (ver su comentario de cabecera) —
 * `@nestjs/bullmq` crea un `Worker` de BullMQ por `@Processor`, y BullMQ
 * reparte los jobs de una cola entre todos los `Worker`s que la escuchan por
 * disponibilidad, no por nombre de job. Con 4 jobs distintos en la misma
 * cola, 4 `Worker`s competirían por cualquiera de ellos.
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ModelCatalogService } from '../../llm/catalog.service.js';
import {
  JOB_DAILY_STREAKS,
  JOB_MODEL_CATALOG,
  JOB_RETENTION,
  JOB_SESSION_SWEEPER,
  QUEUE_CONCURRENCY,
  QUEUE_MAINTENANCE,
} from '../jobs.constants.js';
import { SESSION_SWEEPER, type SessionSweeper, type SessionSweeperResult } from '../session-sweeper.js';
import { DailyStreaksService, type DailyStreaksJobResult } from './daily-streaks.service.js';
import { RetentionService, type RetentionJobResult } from './retention.service.js';

export interface ModelCatalogJobResult {
  readonly status: 'refreshed';
}

type MaintenanceJobResult =
  | SessionSweeperResult
  | DailyStreaksJobResult
  | RetentionJobResult
  | ModelCatalogJobResult;

@Processor(QUEUE_MAINTENANCE, { concurrency: QUEUE_CONCURRENCY[QUEUE_MAINTENANCE] })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @Inject(SESSION_SWEEPER) private readonly sessionSweeper: SessionSweeper,
    private readonly dailyStreaksService: DailyStreaksService,
    private readonly retentionService: RetentionService,
    private readonly modelCatalogService: ModelCatalogService,
  ) {
    super();
  }

  /** Ver `coaching-brief.processor.ts`: errores de la conexión del `Worker`, no de un job. */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_MAINTENANCE}] ${error.message}`);
  }

  async process(job: Job<Record<string, never>>): Promise<MaintenanceJobResult> {
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
      // Se propaga para que BullMQ reintente con el `attempts` que
      // `maintenance.cron.ts` fijó para este job (PEND-05).
      throw error;
    }
  }

  private async runByName(job: Job<Record<string, never>>): Promise<MaintenanceJobResult> {
    switch (job.name) {
      case JOB_SESSION_SWEEPER:
        return this.sessionSweeper.run();
      case JOB_DAILY_STREAKS:
        return this.dailyStreaksService.run();
      case JOB_RETENTION:
        return this.retentionService.run();
      case JOB_MODEL_CATALOG:
        await this.modelCatalogService.refresh();
        return { status: 'refreshed' };
      default:
        throw new Error(`maintenance: job desconocido "${job.name}"`);
    }
  }
}
