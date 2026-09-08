/**
 * Módulo del job `weekly-summary` (SPEC-05 §4).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * `LlmService` se cablea a mano con `useFactory`, igual que
 * `CoachingBriefModule` (PEND-07 de docs/specs/pendientes/PR-05.md): PR-03 no
 * dejó un `LlmModule` de Nest. El `LlmCallSink`, el `LlmEventBus` y
 * `CredentialsCrypto` sí vienen ya hechos de `LlmInfraModule` (PR-02/T4)
 * desde que se fusionó PR-02; la copia que PR-05 tenía en
 * `llm-observability.ts` se borró (docs/specs/pendientes/PR-02.md PEND-75).
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { parseFallbackModels } from '../../llm/config.js';
import { LlmClient } from '../../llm/llm.client.js';
import { LLM_CALL_SINK, LLM_EVENT_BUS } from '../../llm/llm-infra.constants.js';
import { LlmInfraModule } from '../../llm/llm-infra.module.js';
import type { LlmCallSink, LlmEventBus } from '../../llm/llm.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { ModelResolver } from '../../llm/model-resolver.js';
import { WeeklySummaryPendingCredentialStore } from './pending-credential.store.js';
import { WeeklySummaryDispatchRegistrar } from './weekly-summary-dispatch.registrar.js';
import { WeeklySummaryDispatchService } from './weekly-summary-dispatch.service.js';
import { WeeklySummaryProcessor } from './weekly-summary.processor.js';
import {
  InsforgeWeeklySummaryRepository,
  WeeklySummaryRepository,
} from './weekly-summary.repository.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

@Module({
  imports: [LlmInfraModule],
  providers: [
    {
      provide: WeeklySummaryRepository,
      useClass: InsforgeWeeklySummaryRepository,
    },
    WeeklySummaryPendingCredentialStore,
    {
      provide: LlmService,
      inject: [LLM_CALL_SINK, LLM_EVENT_BUS, ConfigService],
      useFactory: (
        sink: LlmCallSink,
        events: LlmEventBus,
        configService: ConfigService<Env, true>,
      ) =>
        new LlmService({
          client: new LlmClient(),
          resolver: new ModelResolver(
            parseFallbackModels(
              configService.get('FALLBACK_MODELS', { infer: true }),
            ),
          ),
          sink,
          events,
        }),
    },
    WeeklySummaryService,
    WeeklySummaryDispatchService,
    WeeklySummaryProcessor,
    WeeklySummaryDispatchRegistrar,
  ],
  exports: [WeeklySummaryService, WeeklySummaryDispatchService],
})
export class WeeklySummaryModule {}
