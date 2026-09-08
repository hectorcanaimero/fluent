/**
 * `LlmCallSink` y `LlmEventBus` mínimos contra InsForge (SPEC-01 §2.14,
 * SPEC-03 §2 y PEND-07 de docs/specs/pendientes/PR-03.md).
 *
 * AVISO (PEND-02 de docs/specs/pendientes/PR-05.md): PR-02 conectará estas dos
 * interfaces del módulo LLM con sus propios servicios (`llm_calls` y
 * `provider_credentials`). Cuando se fusione hay que quedarse con una sola
 * implementación; esta existe porque PR-05 llega antes que PR-02.
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
import { CoachingBriefRepository } from './coaching-brief.repository.js';

@Injectable()
export class InsforgeLlmCallSink implements LlmCallSink {
  private readonly logger = new Logger(InsforgeLlmCallSink.name);
  private readonly promptVersion: number;

  constructor(
    private readonly repository: CoachingBriefRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.promptVersion = configService.get('PROMPT_VERSION', { infer: true });
  }

  async record(call: LlmCallRecord): Promise<void> {
    // `LlmCallRecord.promptVersion` es `string | null` (SPEC-03) pero la columna
    // `llm_calls.prompt_version` es `int` (migración 3). Se convierte, y si el
    // valor no es un entero se usa el de configuración. Ver PEND-04.
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
export class InsforgeLlmEventBus implements LlmEventBus {
  private readonly logger = new Logger(InsforgeLlmEventBus.name);

  constructor(private readonly repository: CoachingBriefRepository) {}

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
