/**
 * Orquestación de la cadena de fallback (SPEC-03 §2).
 *
 * Módulo puro: registra cada intento a través de `LlmCallSink` y avisa de las
 * credenciales rotas con un evento `credential.error`. PR-02 implementa ambas
 * interfaces contra InsForge.
 */
import type { ZodType } from 'zod';

import { MAX_ATTEMPTS, PURPOSE_DEFAULTS, type Provider, type Purpose } from './config.js';
import {
  LlmCallError,
  type LlmCallStatus,
  type LlmClient,
  type LlmMessage,
  type LlmUsage,
} from './llm.client.js';
import type { Candidate, ModelPreference, ModelResolver, ActiveCredential } from './model-resolver.js';

/** Fila de `llm_calls` (SPEC-01 §2.14 + PEND-01 y PEND-02). Nunca lleva el prompt. */
export interface LlmCallRecord {
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly purpose: Purpose;
  readonly provider: Provider;
  readonly model: string;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  readonly latencyMs: number;
  readonly status: LlmCallStatus;
  readonly attempt: number;
  readonly promptVersion: string | null;
}

export interface LlmCallSink {
  record(call: LlmCallRecord): void | Promise<void>;
}

export type CredentialErrorCode = 'AUTH_ERROR' | 'NO_CREDITS';

export interface CredentialErrorEvent {
  readonly userId: string;
  readonly provider: Provider;
  readonly code: CredentialErrorCode;
}

/** Bus mínimo. PR-02 lo conecta con el `EventEmitter` de NestJS. */
export interface LlmEventBus {
  emit(event: 'credential.error', payload: CredentialErrorEvent): void;
}

/** Se lanza cuando se agota la cadena de candidatos (SPEC-03 §2 y §6). */
export class LlmUnavailableError extends Error {
  readonly name = 'LlmUnavailableError';
  readonly code = 'LLM_UNAVAILABLE';

  constructor(
    readonly attempts: readonly LlmAttempt[],
    message = 'No hay ningún modelo disponible para atender la llamada',
  ) {
    super(message);
  }
}

export interface LlmAttempt {
  readonly attempt: number;
  readonly provider: Provider;
  readonly model: string;
  readonly source: Candidate['source'];
  readonly status: LlmCallStatus;
  readonly latencyMs: number;
}

export interface LlmServiceRequest<T> {
  readonly userId: string;
  readonly sessionId?: string | null;
  readonly purpose: Purpose;
  readonly messages: readonly LlmMessage[];
  readonly schema: ZodType<T>;
  readonly credentials: readonly ActiveCredential[];
  readonly preference?: ModelPreference | null;
  readonly promptVersion?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
}

export interface LlmServiceResult<T> {
  readonly data: T;
  readonly modelUsed: string;
  readonly provider: Provider;
  readonly usage: LlmUsage;
  readonly degraded: boolean;
  readonly attempts: readonly LlmAttempt[];
}

export interface LlmServiceDeps {
  readonly client: Pick<LlmClient, 'complete'>;
  readonly resolver: Pick<ModelResolver, 'resolve'>;
  readonly sink?: LlmCallSink;
  readonly events?: LlmEventBus;
}

const NOOP_SINK: LlmCallSink = { record: () => {} };
const NOOP_EVENTS: LlmEventBus = { emit: () => {} };

export class LlmService {
  private readonly client: Pick<LlmClient, 'complete'>;
  private readonly resolver: Pick<ModelResolver, 'resolve'>;
  private readonly sink: LlmCallSink;
  private readonly events: LlmEventBus;

  constructor(deps: LlmServiceDeps) {
    this.client = deps.client;
    this.resolver = deps.resolver;
    this.sink = deps.sink ?? NOOP_SINK;
    this.events = deps.events ?? NOOP_EVENTS;
  }

  async complete<T>(request: LlmServiceRequest<T>): Promise<LlmServiceResult<T>> {
    const defaults = PURPOSE_DEFAULTS[request.purpose];
    const maxAttempts = request.maxAttempts ?? MAX_ATTEMPTS;
    const promptVersion = request.promptVersion ?? null;

    const { candidates, preferenceDropped } = this.resolver.resolve({
      credentials: request.credentials,
      preference: request.preference,
    });

    const attempts: LlmAttempt[] = [];
    const bannedProviders = new Set<Provider>();

    for (const candidate of candidates) {
      if (attempts.length >= maxAttempts) break;
      // SPEC-03 §2: tras un 401/403/402 no se reintenta con ese proveedor.
      if (bannedProviders.has(candidate.provider)) continue;

      const attempt = attempts.length + 1;

      try {
        const result = await this.client.complete({
          provider: candidate.provider,
          model: candidate.model,
          apiKey: candidate.apiKey,
          messages: request.messages,
          schema: request.schema,
          maxTokens: request.maxTokens ?? defaults.maxTokens,
          temperature: request.temperature ?? defaults.temperature,
          purpose: request.purpose,
          timeoutMs: request.timeoutMs ?? defaults.timeoutMs,
        });

        attempts.push({
          attempt,
          provider: candidate.provider,
          model: candidate.model,
          source: candidate.source,
          status: 'ok',
          latencyMs: result.latencyMs,
        });

        await this.sink.record({
          userId: request.userId,
          sessionId: request.sessionId ?? null,
          purpose: request.purpose,
          provider: candidate.provider,
          model: candidate.model,
          tokensIn: result.usage.tokensIn,
          tokensOut: result.usage.tokensOut,
          latencyMs: result.latencyMs,
          status: 'ok',
          attempt,
          promptVersion,
        });

        return {
          data: result.data,
          modelUsed: candidate.model,
          provider: candidate.provider,
          usage: result.usage,
          // PEND-06: degradado si no respondió el primer candidato o si la
          // preferencia del usuario se descartó por falta de credencial.
          degraded: attempt > 1 || preferenceDropped,
          attempts,
        };
      } catch (error) {
        const callError =
          error instanceof LlmCallError
            ? error
            : new LlmCallError('provider_error', candidate.provider, candidate.model, 0);

        attempts.push({
          attempt,
          provider: candidate.provider,
          model: candidate.model,
          source: candidate.source,
          status: callError.status,
          latencyMs: callError.latencyMs,
        });

        await this.sink.record({
          userId: request.userId,
          sessionId: request.sessionId ?? null,
          purpose: request.purpose,
          provider: candidate.provider,
          model: candidate.model,
          tokensIn: null,
          tokensOut: null,
          latencyMs: callError.latencyMs,
          status: callError.status,
          attempt,
          promptVersion,
        });

        if (callError.isCredentialError) {
          bannedProviders.add(candidate.provider);
          this.events.emit('credential.error', {
            userId: request.userId,
            provider: candidate.provider,
            code: callError.status === 'no_credits' ? 'NO_CREDITS' : 'AUTH_ERROR',
          });
        }
      }
    }

    throw new LlmUnavailableError(attempts);
  }
}
