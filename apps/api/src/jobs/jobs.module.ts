/**
 * Agregador de procesadores de BullMQ (SPEC-05).
 *
 * Lo importa solo `WorkerModule` (`node dist/worker.js`): la API HTTP encola
 * a través de `JOB_DISPATCHER` pero no consume.
 *
 * Las tareas T2 a T4 de PR-05 añaden aquí su submódulo (`rss-ingest`,
 * `weekly-summary`, mantenimiento) sin volver a tocar `worker.module.ts`.
 */
import { Module } from '@nestjs/common';

import { CoachingBriefModule } from './coaching-brief/coaching-brief.module.js';
import { RssIngestModule } from './rss-ingest/rss-ingest.module.js';
import { WeeklySummaryModule } from './weekly-summary/weekly-summary.module.js';

@Module({
  imports: [CoachingBriefModule, RssIngestModule, WeeklySummaryModule],
})
export class JobsModule {}
