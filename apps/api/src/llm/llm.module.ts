/**
 * Módulo de NestJS del LLM (PEND-07 de `docs/specs/pendientes/PR-05.md`).
 *
 * PR-03 dejó `ModelResolver` y `LlmService` como clases puras,
 * sin módulo de Nest, así que `CoachingBriefModule` y `WeeklySummaryModule`
 * repetían el mismo `useFactory` para construir `LlmService`. Este módulo
 * centraliza ese cableado:
 *
 * - El proveedor de 9router (`NINEROUTER_PROVIDER`, de `LlmInfraModule`).
 * - `ModelResolver` con la cadena de la variable de entorno `FALLBACK_MODELS`
 *   (SPEC-03 §2), parseada con `parseFallbackModels`.
 * - `LlmCallSink` y `LlmEventBus` reales, por los tokens `LLM_CALL_SINK` y
 *   `LLM_EVENT_BUS` que expone `LlmInfraModule` (PR-02/T4).
 *
 * Reexporta `LlmInfraModule` (y con él `CredentialsModule`, es decir
 * `CredentialsService`) para que quien importe `LlmModule` tenga a la vez el
 * `LlmService` y la fuente de credenciales que necesita para llamarlo.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { parseFallbackModels } from './config.js';
import { LLM_CALL_SINK, LLM_EVENT_BUS } from './llm-infra.constants.js';
import { LlmInfraModule } from './llm-infra.module.js';
import type { LlmCallSink, LlmEventBus } from './llm.service.js';
import { LlmService } from './llm.service.js';
import { ModelResolver } from './model-resolver.js';
import { NINEROUTER_PROVIDER, type NineRouterProvider } from './ninerouter.provider.js';

@Module({
  imports: [LlmInfraModule],
  providers: [
    {
      provide: LlmService,
      inject: [LLM_CALL_SINK, LLM_EVENT_BUS, ConfigService, NINEROUTER_PROVIDER],
      useFactory: (
        sink: LlmCallSink,
        events: LlmEventBus,
        configService: ConfigService<Env, true>,
        provider: NineRouterProvider,
      ) =>
        new LlmService({
          provider,
          resolver: new ModelResolver(
            parseFallbackModels(
              configService.get('FALLBACK_MODELS', { infer: true }),
            ),
          ),
          sink,
          events,
        }),
    },
  ],
  exports: [LlmService, LlmInfraModule],
})
export class LlmModule {}
