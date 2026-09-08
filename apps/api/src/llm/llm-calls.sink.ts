import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InsForgeClient } from '@insforge/sdk';
import type { Env } from '../config/env.js';
import { TABLES } from '../db/schema.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import type { LlmCallRecord, LlmCallSink } from './llm.service.js';

/**
 * Convierte el `promptVersion` de `LlmCallRecord` (`string | null`, tal y
 * como lo declara la interfaz de PR-03) al `int` de la columna
 * `llm_calls.prompt_version` (SPEC-01 §2.14, docs/specs/pendientes/PR-03.md
 * PEND-02).
 *
 * Cualquier valor que no sea un entero no negativo (nulo, vacío, `"v3"`,
 * `"1.2"`) cae al `PROMPT_VERSION` de la configuración: la observabilidad
 * nunca debe hacer fallar un INSERT por un formato inesperado.
 */
export function toPromptVersion(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw.trim());
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * `LlmCallSink` (SPEC-03 §2) escrito sobre `llm_calls` (SPEC-01 §2.14) con el
 * cliente admin de InsForge. Traduce el registro camelCase de PR-03 a las
 * columnas snake_case de la tabla.
 *
 * `llm_calls` es **observabilidad**: si el INSERT falla, se loguea `warn` y se
 * sigue. Nunca lanza, para no tumbar la petición del usuario por un fallo de
 * registro. La tabla nunca guarda el contenido del prompt (SPEC-01 §2.14).
 */
@Injectable()
export class InsforgeLlmCallSink implements LlmCallSink {
  private readonly logger = new Logger(InsforgeLlmCallSink.name);
  private readonly defaultPromptVersion: number;

  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient,
    configService: ConfigService<Env, true>,
  ) {
    this.defaultPromptVersion = configService.get('PROMPT_VERSION', { infer: true });
  }

  async record(call: LlmCallRecord): Promise<void> {
    try {
      const { error } = await this.admin.database.from(TABLES.llmCalls).insert({
        user_id: call.userId,
        session_id: call.sessionId,
        purpose: call.purpose,
        provider: call.provider,
        model: call.model,
        tokens_in: call.tokensIn,
        tokens_out: call.tokensOut,
        latency_ms: call.latencyMs,
        status: call.status,
        attempt: call.attempt,
        prompt_version: toPromptVersion(call.promptVersion, this.defaultPromptVersion),
      });

      if (error) {
        this.logger.warn(`No se pudo registrar la llamada en llm_calls: ${error.message}`);
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la llamada en llm_calls: ${(error as Error).message}`,
      );
    }
  }
}
