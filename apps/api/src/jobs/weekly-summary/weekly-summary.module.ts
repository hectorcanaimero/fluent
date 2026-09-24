/**
 * Módulo del job `weekly-summary` (SPEC-05 §4).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * `LlmService` ya viene construido de `LlmModule` (PR-04/T1), que centraliza
 * el `useFactory` que este módulo duplicaba con `CoachingBriefModule`
 * (PEND-07 de docs/specs/pendientes/PR-05.md). `LlmModule` reexporta
 * `LlmInfraModule` (y con él `CredentialsModule`), así que `CredentialsService`
 * y los tokens `LLM_CALL_SINK`/`LLM_EVENT_BUS` siguen disponibles aquí.
 */
import { Module } from '@nestjs/common';

import { LlmModule } from '../../llm/llm.module.js';
import { PushCoreModule } from '../../push/push.module.js';
import { WeeklySummaryDispatchRegistrar } from './weekly-summary-dispatch.registrar.js';
import { WeeklySummaryDispatchService } from './weekly-summary-dispatch.service.js';
import { WeeklySummaryProcessor } from './weekly-summary.processor.js';
import {
  InsforgeWeeklySummaryRepository,
  WeeklySummaryRepository,
} from './weekly-summary.repository.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

@Module({
  imports: [LlmModule, PushCoreModule],
  providers: [
    {
      provide: WeeklySummaryRepository,
      useClass: InsforgeWeeklySummaryRepository,
    },
    WeeklySummaryService,
    WeeklySummaryDispatchService,
    WeeklySummaryProcessor,
    WeeklySummaryDispatchRegistrar,
  ],
  exports: [WeeklySummaryService, WeeklySummaryDispatchService],
})
export class WeeklySummaryModule {}
