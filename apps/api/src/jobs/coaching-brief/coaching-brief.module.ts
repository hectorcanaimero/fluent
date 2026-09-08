/**
 * Módulo del job `coaching-brief` (SPEC-05 §2).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * Aquí se arma también la instancia de `LlmService` (PR-03 dejó el módulo LLM
 * como clases puras, sin módulo de NestJS; PEND-07 de
 * docs/specs/pendientes/PR-05.md). Lo que sí existe desde que se fusionó PR-02
 * es `LlmInfraModule`, que aporta las implementaciones de `LlmCallSink`
 * (`llm_calls`), `LlmEventBus` (`EventEmitter2` + `CredentialErrorListener`) y
 * `CredentialsCrypto`: este módulo las inyecta por sus tokens en vez de
 * traerse la copia que PR-05 tenía en `llm-observability.ts`, que se borró
 * (docs/specs/pendientes/PR-02.md PEND-75).
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
import {
  CoachingBriefRepository,
  InsforgeCoachingBriefRepository,
} from './coaching-brief.repository.js';
import { CoachingBriefProcessor } from './coaching-brief.processor.js';
import { CoachingBriefService } from './coaching-brief.service.js';

@Module({
  imports: [LlmInfraModule],
  providers: [
    {
      provide: CoachingBriefRepository,
      useClass: InsforgeCoachingBriefRepository,
    },
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
    CoachingBriefService,
    CoachingBriefProcessor,
  ],
  exports: [CoachingBriefService],
})
export class CoachingBriefModule {}
