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
  /**
   * Streaming (SPEC-04 §4, RF-3.8): se pasa tal cual al cliente, que pide
   * `stream: true` y llama con cada delta del campo `reply`.
   *
   * Ojo con la cadena de fallback: si un intento emite tokens y luego falla
   * (por ejemplo `invalid_json`), el intento siguiente vuelve a emitir desde
   * el principio. Por eso el endpoint SSE manda el `TurnResult` completo en el
   * evento `done` y la app lo trata como la fuente de verdad (PEND-56).
   */
  readonly onToken?: (delta: string) => void;

  /**
   * Se llama **antes** de reintentar con otro modelo, y solo si el intento
   * anterior ya había emitido algún token (MAL-22).
   *
   * Sin esto, el texto del intento fallido y el del siguiente se concatenaban
   * en la burbuja del aprendiz: veía media frase de un modelo pegada a la
   * respuesta completa de otro. El endpoint SSE lo serializa como
   * `event: reset` y la app vacía la burbuja viva.
   */
  readonly onReset?: () => void;
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

/**
 * Registra la llamada sin bloquear (MEJ-25): `llm_calls` es auditoría, y
 * esperar a que InsForge la escriba retrasaba la respuesta del turno que el
 * aprendiz está esperando.
 *
 * `record` puede devolver `void` (el sink de los tests) o una promesa, así
 * que se normaliza antes de colgarle el `catch`. El sink real ya se traga sus
 * propios errores; esto es el cinturón por si alguna vez deja de hacerlo.
 */
function recordQuietly(sink: LlmCallSink, call: LlmCallRecord): Promise<void> {
  return Promise.resolve(sink.record(call)).catch(() => undefined);
}
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

    /**
     * ¿El intento anterior llegó a emitir algo? Si no, no hay nada que
     * vaciar y el `reset` solo sería ruido (MAL-22).
     */
    let emittedTokens = false;

    for (const candidate of candidates) {
      if (attempts.length >= maxAttempts) break;
      // SPEC-03 §2: tras un 401/403/402 no se reintenta con ese proveedor.
      if (bannedProviders.has(candidate.provider)) continue;

      const attempt = attempts.length + 1;

      if (emittedTokens) {
        // Reintento tras un intento que ya había pintado texto: la app tiene
        // que tirar lo que lleve antes de que empiece a llegar lo nuevo.
        request.onReset?.();
        emittedTokens = false;
      }

      const onToken = request.onToken
        ? (delta: string): void => {
            emittedTokens = true;
            request.onToken?.(delta);
          }
        : undefined;

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
          onToken,
        });

        attempts.push({
          attempt,
          provider: candidate.provider,
          model: candidate.model,
          source: candidate.source,
          status: 'ok',
          latencyMs: result.latencyMs,
        });

        // Sin `await` (MEJ-25): `llm_calls` es auditoría, y esperar a que
        // InsForge la escriba retrasaba la respuesta del turno que el
        // aprendiz está esperando. El sink ya se traga sus propios errores;
        // el `.catch` es el cinturón por si alguna vez deja de hacerlo.
        void recordQuietly(this.sink, {
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

        // Sin `await` (MEJ-25): `llm_calls` es auditoría, y esperar a que
        // InsForge la escriba retrasaba la respuesta del turno que el
        // aprendiz está esperando. El sink ya se traga sus propios errores;
        // el `.catch` es el cinturón por si alguna vez deja de hacerlo.
        void recordQuietly(this.sink, {
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
