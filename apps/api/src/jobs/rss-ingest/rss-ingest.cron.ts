/**
 * Registro del cron diario 06:00 UTC de `rss-ingest` (SPEC-05 §1 y §3).
 *
 * Usa el mecanismo de *repeatable jobs* de BullMQ, no `@nestjs/schedule`: en
 * `onModuleInit` se añade el job repetible a la cola `content`.
 *
 * PEND-15 de docs/specs/pendientes/PR-05.md: el encargo original describía
 * `queue.add(name, data, { repeat: {...}, jobId })`, pero `bullmq@6.3.4`
 * (la versión instalada por T1) quitó `repeat` de `JobsOptions` en favor de
 * `Queue.upsertJobScheduler(schedulerId, repeatOpts, jobTemplate)` — es un
 * *upsert* explícito por diseño, así que reiniciar el worker no crea
 * duplicados (llamarlo de nuevo con el mismo `schedulerId` y las mismas
 * opciones no añade una segunda entrada; BullMQ vincula el scheduler a un
 * único `jobId` estable).
 */
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { JOB_RSS_INGEST, QUEUE_CONTENT } from '../jobs.constants.js';

/** SPEC-05 §1: «cron diario 06:00 UTC». */
export const RSS_INGEST_CRON_PATTERN = '0 6 * * *';
export const RSS_INGEST_CRON_JOB_ID = 'cron-rss-ingest';

@Injectable()
export class RssIngestCronService implements OnModuleInit {
  private readonly logger = new Logger(RssIngestCronService.name);

  constructor(
    @InjectQueue(QUEUE_CONTENT) private readonly contentQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.contentQueue.upsertJobScheduler(
      RSS_INGEST_CRON_JOB_ID,
      { pattern: RSS_INGEST_CRON_PATTERN, tz: 'UTC' },
      { name: JOB_RSS_INGEST, data: {} },
    );
    this.logger.log(
      `cron ${RSS_INGEST_CRON_PATTERN} (UTC) registrado para ${JOB_RSS_INGEST}`,
    );
  }
}
