/**
 * Módulo del job `weekly-summary` (SPEC-05 §4).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * `LlmService` se cablea a mano con `useFactory`, igual que
 * `CoachingBriefModule` (PEND-07 de docs/specs/pendientes/PR-05.md): PR-03 no
 * dejó un `LlmModule` de Nest. Si PR-02 o PR-04 crean uno, este cableado debe
 * sustituirse por su import.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { CredentialsCipher } from '../../crypto/credentials-cipher.js';
import { parseFallbackModels } from '../../llm/config.js';
import { LlmClient } from '../../llm/llm.client.js';
import { LlmService } from '../../llm/llm.service.js';
import { ModelResolver } from '../../llm/model-resolver.js';
import {
  InsforgeWeeklySummaryLlmCallSink,
  InsforgeWeeklySummaryLlmEventBus,
} from './llm-observability.js';
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
  providers: [
    {
      provide: WeeklySummaryRepository,
      useClass: InsforgeWeeklySummaryRepository,
    },
    CredentialsCipher,
    WeeklySummaryPendingCredentialStore,
    InsforgeWeeklySummaryLlmCallSink,
    InsforgeWeeklySummaryLlmEventBus,
    {
      provide: LlmService,
      inject: [
        InsforgeWeeklySummaryLlmCallSink,
        InsforgeWeeklySummaryLlmEventBus,
        ConfigService,
      ],
      useFactory: (
        sink: InsforgeWeeklySummaryLlmCallSink,
        events: InsforgeWeeklySummaryLlmEventBus,
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
