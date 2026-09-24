import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_CALL_SINK } from './llm-infra.constants.js';
import { InsforgeLlmCallSink } from './llm-calls.sink.js';
import { createNineRouterProvider, NINEROUTER_PROVIDER } from './ninerouter.provider.js';

/**
 * Infraestructura del módulo LLM que aporta PR-02/T4: las implementaciones
 * reales de las interfaces que `apps/api/src/llm/` (PR-03) deja declaradas y
 * no implementa.
 *
 * - `LlmCallSink` → `InsforgeLlmCallSink` (token `LLM_CALL_SINK`).
 *
 * PR-04 y PR-05 solo tienen que importar este módulo para construir un
 * `LlmService` completo:
 *
 * ```ts
 * new LlmService({ provider, resolver, sink })
 * ```
 */
@Module({
  providers: [
    InsforgeLlmCallSink,
    { provide: LLM_CALL_SINK, useExisting: InsforgeLlmCallSink },
    {
      provide: NINEROUTER_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createNineRouterProvider({
          NINEROUTER_URL: config.getOrThrow<string>('NINEROUTER_URL'),
          NINEROUTER_API_KEY: config.getOrThrow<string>('NINEROUTER_API_KEY'),
        }),
    },
  ],
  exports: [
    InsforgeLlmCallSink,
    LLM_CALL_SINK,
    NINEROUTER_PROVIDER,
  ],
})
export class LlmInfraModule {}
