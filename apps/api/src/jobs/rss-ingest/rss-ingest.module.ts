/**
 * Módulo del job `rss-ingest` (SPEC-05 §3).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores. `RssIngestService` es una clase
 * pura (sin decorador de Nest, ver PEND-07 y el propio archivo) construida
 * aquí con un `useFactory`, mismo patrón que `CoachingBriefModule` con
 * `LlmService`.
 */
import { Module } from '@nestjs/common';

import {
  InsforgeRssIngestRepository,
  RssIngestRepository,
} from './rss-ingest.repository.js';
import { RssIngestCronService } from './rss-ingest.cron.js';
import { RssIngestProcessor } from './rss-ingest.processor.js';
import { RssIngestService } from './rss-ingest.service.js';

@Module({
  providers: [
    { provide: RssIngestRepository, useClass: InsforgeRssIngestRepository },
    {
      provide: RssIngestService,
      inject: [RssIngestRepository],
      useFactory: (repository: RssIngestRepository) =>
        new RssIngestService({ repository }),
    },
    RssIngestProcessor,
    RssIngestCronService,
  ],
  exports: [RssIngestService],
})
export class RssIngestModule {}
