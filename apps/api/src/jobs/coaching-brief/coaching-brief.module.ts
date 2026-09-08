/**
 * Módulo del job `coaching-brief` (SPEC-05 §2).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * Aquí se arma también la instancia de `LlmService` (PR-03 dejó el módulo LLM
 * como clases puras, sin módulo de NestJS). Ver PEND-07 de
 * docs/specs/pendientes/PR-05.md: si PR-02 o PR-04 crean un `LlmModule`, este
 * cableado debe sustituirse por su import.
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
  CoachingBriefRepository,
  InsforgeCoachingBriefRepository,
} from './coaching-brief.repository.js';
import { CoachingBriefProcessor } from './coaching-brief.processor.js';
import { CoachingBriefService } from './coaching-brief.service.js';
import {
  InsforgeLlmCallSink,
  InsforgeLlmEventBus,
} from './llm-observability.js';

@Module({
  providers: [
    {
      provide: CoachingBriefRepository,
      useClass: InsforgeCoachingBriefRepository,
    },
    CredentialsCipher,
    InsforgeLlmCallSink,
    InsforgeLlmEventBus,
    {
      provide: LlmService,
      inject: [InsforgeLlmCallSink, InsforgeLlmEventBus, ConfigService],
      useFactory: (
        sink: InsforgeLlmCallSink,
        events: InsforgeLlmEventBus,
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
    CoachingBriefService,
    CoachingBriefProcessor,
  ],
  exports: [CoachingBriefService],
})
export class CoachingBriefModule {}
