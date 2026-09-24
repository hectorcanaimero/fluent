/**
 * Orquestación de la cadena de fallback (SPEC-03 §2).
 *
 * Módulo puro: registra cada intento a través de `LlmCallSink` y avisa de las
 * credenciales rotas con un evento `credential.error`. PR-02 implementa ambas
 * interfaces contra InsForge.
 */
import {
  APICallError,
  generateObject,
  NoObjectGeneratedError,
  streamObject,
  type LanguageModel,
  type RepairTextFunction,
} from 'ai';
import type { ZodType } from 'zod';

import { MAX_ATTEMPTS, PURPOSE_DEFAULTS, type Provider, type Purpose } from './config.js';
import { extractFirstJsonObject } from './json.js';
import type { Plan } from '../db/schema.js';
import type { Candidate, ModelPreference, ModelResolver } from './model-resolver.js';
import {
  LlmCallError,
  type LlmCallStatus,
  type LlmErrorStatus,
  type LlmMessage,
  type LlmUsage,
} from './types.js';

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
  readonly plan: Plan;
  readonly preference?: ModelPreference | null;
  readonly promptVersion?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  /**
   * Streaming (SPEC-04 §4, RF-3.8): con `onToken` el intento usa
   * `streamObject` y se llama con cada delta del campo `reply`.
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
  /** `NineRouterProvider` en producción; cualquier `(modelId) => LanguageModel` en tests. */
  readonly provider: (modelId: string) => LanguageModel;
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

// ponytail: mapa local hasta que F1.4 traiga `reasoningEffortFor` en `ninerouter-models.ts`.
function reasoningEffortFor(model: string): string | undefined {
  if (model === 'fluent-free' || model === 'fluent-pro' || model.startsWith('ds/')) return 'none';
  if (model.startsWith('gemini/gemini-3.8')) return 'low';
  return undefined;
}

/** Quita vallas ```json y prosa: algunos modelos las mandan incluso con `response_format`. */
const repairText: RepairTextFunction = async ({ text }) => {
  const json = extractFirstJsonObject(text);
  return json === null ? null : JSON.stringify(json);
};

function isAbortError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/** Traduce un error del SDK a `llm_calls.status` (tabla `mapError` de la arquitectura). */
export function mapError(error: unknown, aborted = false): LlmErrorStatus {
  if (aborted || isAbortError(error)) return 'timeout';
  if (error instanceof LlmCallError) return error.status;
  if (NoObjectGeneratedError.isInstance(error)) return 'invalid_json';
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'auth_error';
    if (error.statusCode === 429) return 'rate_limited';
  }
  // Incluye las partes `error` de `fullStream`.
  return 'provider_error';
}

interface AttemptResult<T> {
  readonly data: T;
  readonly usage: LlmUsage;
}

export class LlmService {
  private readonly provider: (modelId: string) => LanguageModel;
  private readonly resolver: Pick<ModelResolver, 'resolve'>;
  private readonly sink: LlmCallSink;
  private readonly events: LlmEventBus;

  constructor(deps: LlmServiceDeps) {
    this.provider = deps.provider;
    this.resolver = deps.resolver;
    this.sink = deps.sink ?? NOOP_SINK;
    this.events = deps.events ?? NOOP_EVENTS;
  }

  async complete<T>(request: LlmServiceRequest<T>): Promise<LlmServiceResult<T>> {
    const defaults = PURPOSE_DEFAULTS[request.purpose];
    const maxAttempts = request.maxAttempts ?? MAX_ATTEMPTS;
    const promptVersion = request.promptVersion ?? null;

    const { candidates, preferenceDropped } = this.resolver.resolve({
      plan: request.plan,
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

      const started = Date.now();
      const signal = AbortSignal.timeout(request.timeoutMs ?? defaults.timeoutMs);

      try {
        const result = await this.attempt(request, candidate.model, signal, onToken);
        const latencyMs = Date.now() - started;

        attempts.push({
          attempt,
          provider: candidate.provider,
          model: candidate.model,
          source: candidate.source,
          status: 'ok',
          latencyMs,
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
          latencyMs,
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
          // preferencia del usuario se descartó porque su plan no la permite.
          degraded: attempt > 1 || preferenceDropped,
          attempts,
        };
      } catch (error) {
        const callError = new LlmCallError(
          mapError(error, signal.aborted),
          candidate.provider,
          candidate.model,
          Date.now() - started,
          APICallError.isInstance(error) ? error.statusCode : undefined,
        );

        attempts.push({
          attempt,
          provider: candidate.provider,
          model: candidate.model,
          source: candidate.source,
          status: callError.status,
          latencyMs: callError.latencyMs,
        });

        // Este **sí** se espera. Es la auditoría de un intento fallido, la
        // más valiosa, y con `void` perdía la carrera contra el borrado de la
        // sesión que hace `openSession` en su camino de error: la FK a
        // `sessions` rechazaba el insert y la fila se perdía en silencio.
        // Aquí esperar no cuesta nada en la ruta caliente, porque la ruta
        // caliente es la del intento que sale bien.
        await recordQuietly(this.sink, {
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

  /** Un intento contra un modelo: `generateObject`, o `streamObject` si hay `onToken`. */
  private async attempt<T>(
    request: LlmServiceRequest<T>,
    model: string,
    abortSignal: AbortSignal,
    onToken: ((delta: string) => void) | undefined,
  ): Promise<AttemptResult<T>> {
    const defaults = PURPOSE_DEFAULTS[request.purpose];
    const reasoningEffort = reasoningEffortFor(model);
    const options = {
      model: this.provider(model),
      schema: request.schema,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      // Los prompts abren con un mensaje `system`; el SDK 7 lo rechaza sin esto.
      allowSystemInMessages: true,
      temperature: request.temperature ?? defaults.temperature,
      maxOutputTokens: request.maxTokens ?? defaults.maxTokens,
      abortSignal,
      // D6: los reintentos son la cadena de candidatos, no el SDK.
      maxRetries: 0,
      repairText,
      providerOptions:
        reasoningEffort === undefined ? undefined : { '9router': { reasoningEffort } },
    };

    if (onToken === undefined) {
      const result = await generateObject(options);
      return { data: result.object as T, usage: toUsage(result.usage) };
    }

    // Los errores llegan como partes `error` de `fullStream`; sin esto el SDK
    // además los escribe en consola.
    const result = streamObject({ ...options, onError: () => {} });
    let previousReply = '';
    let emitting = true;
    for await (const part of result.fullStream) {
      if (part.type === 'error') throw part.error;
      if (part.type !== 'object' || !emitting) continue;
      const reply = (part.object as { reply?: unknown } | undefined)?.reply;
      if (typeof reply !== 'string') continue;
      // Si el parcial reescribe lo ya emitido se deja de emitir: el `done`
      // del SSE manda el objeto entero.
      if (!reply.startsWith(previousReply)) {
        emitting = false;
        continue;
      }
      const delta = reply.slice(previousReply.length);
      previousReply = reply;
      if (delta === '') continue;
      try {
        onToken(delta);
      } catch {
        // El cliente del SSE colgó: se deja de emitir, pero el turno sigue
        // hasta el final para poder persistirlo.
        emitting = false;
      }
    }
    const [object, usage] = await Promise.all([result.object, result.usage]);
    return { data: object as T, usage: toUsage(usage) };
  }
}

function toUsage(usage: { inputTokens: number | undefined; outputTokens: number | undefined }): LlmUsage {
  return { tokensIn: usage.inputTokens ?? null, tokensOut: usage.outputTokens ?? null };
}
