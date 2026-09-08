import { Module } from '@nestjs/common';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { LLM_CALL_SINK, LLM_EVENT_BUS } from './llm-infra.constants.js';
import { InsforgeLlmCallSink } from './llm-calls.sink.js';
import { NestLlmEventBus } from './nest-llm-event-bus.js';

/**
 * Infraestructura del módulo LLM que aporta PR-02/T4: las implementaciones
 * reales de las tres interfaces que `apps/api/src/llm/` (PR-03) deja
 * declaradas y no implementa.
 *
 * - `CredentialsSource` → `CredentialsService` (reexportado con
 *   `CredentialsModule`).
 * - `LlmCallSink` → `InsforgeLlmCallSink` (token `LLM_CALL_SINK`).
 * - `LlmEventBus` → `NestLlmEventBus` (token `LLM_EVENT_BUS`).
 *
 * PR-04 y PR-05 solo tienen que importar este módulo para construir un
 * `LlmService` completo:
 *
 * ```ts
 * new LlmService({ client, resolver, sink, events })
 * ```
 */
@Module({
  imports: [CredentialsModule],
  providers: [
    InsforgeLlmCallSink,
    NestLlmEventBus,
    { provide: LLM_CALL_SINK, useExisting: InsforgeLlmCallSink },
    { provide: LLM_EVENT_BUS, useExisting: NestLlmEventBus },
  ],
  exports: [
    CredentialsModule,
    InsforgeLlmCallSink,
    NestLlmEventBus,
    LLM_CALL_SINK,
    LLM_EVENT_BUS,
  ],
})
export class LlmInfraModule {}
