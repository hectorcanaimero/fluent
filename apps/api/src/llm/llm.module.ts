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
 * - `LlmCallSink` real, por el token `LLM_CALL_SINK` que expone
 *   `LlmInfraModule` (PR-02/T4).
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { parseFallbackModels } from './config.js';
import { LLM_CALL_SINK } from './llm-infra.constants.js';
import { LlmInfraModule } from './llm-infra.module.js';
import type { LlmCallSink } from './llm.service.js';
import { LlmService } from './llm.service.js';
import { ModelResolver } from './model-resolver.js';
import { NINEROUTER_PROVIDER, type NineRouterProvider } from './ninerouter.provider.js';

@Module({
  imports: [LlmInfraModule],
  providers: [
    {
      provide: LlmService,
      inject: [LLM_CALL_SINK, ConfigService, NINEROUTER_PROVIDER],
      useFactory: (
        sink: LlmCallSink,
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
        }),
    },
  ],
  exports: [LlmService, LlmInfraModule],
})
export class LlmModule {}
