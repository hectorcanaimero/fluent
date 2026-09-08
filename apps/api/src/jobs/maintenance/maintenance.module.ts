/**
 * Módulo de la cola `maintenance` (SPEC-05 §1 y §5 a §8, PR-05/T4).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * `ModelCatalogService` es una clase pura de PR-03 (sin módulo de Nest,
 * PEND-07 de docs/specs/pendientes/PR-05.md), se cablea aquí con
 * `useFactory` igual que `LlmService` en `coaching-brief.module.ts`.
 * `RetentionService` también es una clase pura (necesita un reloj
 * inyectable para los tests, ver `retention.service.ts`); `DailyStreaksService`
 * sí es un provider normal de Nest porque solo depende de `MaintenanceRepository`.
 *
 * `SESSION_SWEEPER` se registra aquí con `NullSessionSweeper` como provider
 * por defecto (ver `session-sweeper.ts` y PEND-24): cuando PR-04 exista,
 * sustituye este binding por el suyo sin tocar `MaintenanceProcessor`.
 */
import { Module } from '@nestjs/common';

import { ModelCatalogService } from '../../llm/catalog.service.js';
import { NullSessionSweeper, SESSION_SWEEPER } from '../session-sweeper.js';
import { DailyStreaksService } from './daily-streaks.service.js';
import { MaintenanceCronRegistrar } from './maintenance.cron.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import {
  InsforgeMaintenanceRepository,
  MaintenanceRepository,
} from './maintenance.repository.js';
import { RedisCacheStore } from './redis-cache-store.js';
import { RetentionService } from './retention.service.js';

@Module({
  providers: [
    {
      provide: MaintenanceRepository,
      useClass: InsforgeMaintenanceRepository,
    },
    { provide: SESSION_SWEEPER, useClass: NullSessionSweeper },
    RedisCacheStore,
    {
      provide: ModelCatalogService,
      inject: [RedisCacheStore],
      useFactory: (cache: RedisCacheStore) => new ModelCatalogService({ cache }),
    },
    {
      provide: RetentionService,
      inject: [MaintenanceRepository],
      useFactory: (repository: MaintenanceRepository) =>
        new RetentionService({ repository }),
    },
    DailyStreaksService,
    MaintenanceProcessor,
    MaintenanceCronRegistrar,
  ],
})
export class MaintenanceModule {}
