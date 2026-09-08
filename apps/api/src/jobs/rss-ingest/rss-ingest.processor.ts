/**
 * Procesador BullMQ de la cola `content` (SPEC-05 §1 y §3). Mismo patrón que
 * `coaching-brief.processor.ts`: concurrencia de `QUEUE_CONCURRENCY`, log
 * `{ job, id, durationMs, result }` en JSON (SPEC-05 §9) y propagación del
 * error para que BullMQ reintente con el backoff de la cola `content`.
 */
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUE_CONTENT, QUEUE_CONCURRENCY } from '../jobs.constants.js';
import { RssIngestService, type RssIngestJobResult } from './rss-ingest.service.js';

@Injectable()
@Processor(QUEUE_CONTENT, { concurrency: QUEUE_CONCURRENCY[QUEUE_CONTENT] })
export class RssIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(RssIngestProcessor.name);

  constructor(private readonly service: RssIngestService) {
    super();
  }

  /** Ver `coaching-brief.processor.ts`: errores de la conexión del `Worker`, no de un job. */
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`[${QUEUE_CONTENT}] ${error.message}`);
  }

  async process(job: Job<Record<string, never>>): Promise<RssIngestJobResult> {
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
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
      throw error;
    }
  }
}
