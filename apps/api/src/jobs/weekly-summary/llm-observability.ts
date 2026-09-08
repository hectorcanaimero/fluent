/**
 * `LlmCallSink` y `LlmEventBus` mínimos contra InsForge (SPEC-01 §2.14,
 * SPEC-03 §2), copia deliberada de `jobs/coaching-brief/llm-observability.ts`
 * apuntando a `WeeklySummaryRepository` en vez de `CoachingBriefRepository`.
 *
 * PEND-02 de docs/specs/pendientes/PR-05.md ya avisa de que no hay un
 * repositorio genérico compartido entre jobs todavía: duplicar estas ~30
 * líneas es más simple que introducir una abstracción nueva solo para esto.
 * Cuando PR-02 fusione su propio `CredentialsService`/observabilidad de LLM,
 * las tres implementaciones (esta, la de `coaching-brief` y la de PR-02)
 * deben colapsar en una sola.
 *
 * Ninguna de las dos puede tumbar el job: un fallo escribiendo observabilidad
 * se registra y se ignora.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import type { Provider } from '../../db/schema.js';
import type {
  CredentialErrorEvent,
  LlmCallRecord,
  LlmCallSink,
  LlmEventBus,
} from '../../llm/llm.service.js';
import { WeeklySummaryRepository } from './weekly-summary.repository.js';

@Injectable()
export class InsforgeWeeklySummaryLlmCallSink implements LlmCallSink {
  private readonly logger = new Logger(InsforgeWeeklySummaryLlmCallSink.name);
  private readonly promptVersion: number;

  constructor(
    private readonly repository: WeeklySummaryRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = configService.get('PROMPT_VERSION', { infer: true });
  }

  async record(call: LlmCallRecord): Promise<void> {
    // `LlmCallRecord.promptVersion` es `string | null` (SPEC-03) pero la columna
    // `llm_calls.prompt_version` es `int` (migración 3). Ver PEND-04 de
    // docs/specs/pendientes/PR-05.md (mismo criterio que `coaching-brief`).
    const parsed = Number(call.promptVersion);
    const promptVersion = Number.isInteger(parsed) ? parsed : this.promptVersion;

    try {
      await this.repository.insertLlmCall({
        user_id: call.userId,
        session_id: call.sessionId,
        purpose: call.purpose,
        provider: call.provider,
        model: call.model,
        prompt_version: promptVersion,
        tokens_in: call.tokensIn,
        tokens_out: call.tokensOut,
        latency_ms: call.latencyMs,
        status: call.status,
        attempt: call.attempt,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la llamada al LLM: ${(error as Error).message}`,
      );
    }
  }
}

@Injectable()
export class InsforgeWeeklySummaryLlmEventBus implements LlmEventBus {
  private readonly logger = new Logger(InsforgeWeeklySummaryLlmEventBus.name);

  constructor(private readonly repository: WeeklySummaryRepository) {}

  emit(event: 'credential.error', payload: CredentialErrorEvent): void {
    if (event !== 'credential.error') return;
    // `LlmEventBus.emit` es síncrono por contrato: se lanza la escritura y se
    // capturan sus errores, sin bloquear la cadena de fallback del LLM.
    void this.repository
      .markCredentialError(
        payload.userId,
        payload.provider as Provider,
        payload.code,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `No se pudo marcar la credencial de ${payload.provider} como error: ${
            (error as Error).message
          }`,
        );
      });
  }
}
