/**
 * Adaptador único compatible con OpenAI (SPEC-03 §1).
 *
 * Clase pura: no depende de NestJS ni de ningún SDK de proveedor. Habla HTTP con
 * `fetch` nativo de Node 24 contra `<baseUrl>/chat/completions`.
 *
 * Invariante de seguridad: la API key solo viaja en la cabecera `Authorization`.
 * Nunca se registra, ni se incluye en mensajes de error, ni se serializa.
 */
import type { ZodType } from 'zod';

import { PROVIDERS, type Provider, type Purpose } from './config.js';
import { extractFirstJsonObject } from './json.js';

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LlmRequest<T> {
  readonly provider: Provider;
  readonly model: string;
  /** Ya descifrada, solo en memoria. Nunca se registra. */
  readonly apiKey: string;
  readonly messages: readonly LlmMessage[];
  readonly schema: ZodType<T>;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly purpose: Purpose;
  readonly timeoutMs: number;
}

export interface LlmUsage {
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface LlmResult<T> {
  readonly data: T;
  readonly usage: LlmUsage;
  readonly latencyMs: number;
  readonly model: string;
  readonly provider: Provider;
}

/**
 * Estados registrados en `llm_calls.status`.
 * Ver PENDIENTES PEND-01: amplía el conjunto de SPEC-01 §2.14.
 */
export type LlmCallStatus =
  | 'ok'
  | 'invalid_json'
  | 'provider_error'
  | 'rate_limited'
  | 'auth_error'
  | 'no_credits'
  | 'timeout';

export type LlmErrorStatus = Exclude<LlmCallStatus, 'ok'>;

/** Error de una llamada concreta. Nunca contiene la API key. */
export class LlmCallError extends Error {
  readonly name = 'LlmCallError';

  constructor(
    readonly status: LlmErrorStatus,
    readonly provider: Provider,
    readonly model: string,
    readonly latencyMs: number,
    readonly httpStatus?: number,
    /** Fragmento del cuerpo de la respuesta, recortado. Nunca incluye cabeceras. */
    readonly detail?: string,
  ) {
    super(`${status}${httpStatus !== undefined ? ` (HTTP ${httpStatus})` : ''} en ${provider}/${model}`);
  }

  /** ¿Es un fallo de credencial? Entonces no se reintenta con ese proveedor (SPEC-03 §2). */
  get isCredentialError(): boolean {
    return this.status === 'auth_error' || this.status === 'no_credits';
  }
}

/** Logger mínimo. Se inyecta para poder comprobar en tests que la key nunca sale. */
export interface LlmLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const NOOP_LOGGER: LlmLogger = { debug: () => {}, warn: () => {} };

export interface LlmClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly logger?: LlmLogger;
  readonly now?: () => number;
}

/** Cabeceras de una petición, con la key ya puesta. Solo se construye para `fetch`. */
function buildHeaders(provider: Provider, apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...PROVIDERS[provider].extraHeaders,
  };
}

function mapHttpStatus(httpStatus: number): LlmErrorStatus {
  if (httpStatus === 401 || httpStatus === 403) return 'auth_error';
  if (httpStatus === 402) return 'no_credits';
  if (httpStatus === 429) return 'rate_limited';
  return 'provider_error';
}

function clip(text: string, max = 300): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Último cinturón de seguridad: algunos proveedores devuelven la key recibida dentro
 * del cuerpo del error. Se borra antes de que el texto llegue a un log o a la base.
 */
function redact(text: string, apiKey: string): string {
  if (apiKey.length === 0) return text;
  return text.split(apiKey).join('[REDACTED]');
}

/** El contenido puede llegar como string o como array de partes (algunos proveedores). */
function readContent(message: unknown): string {
  if (typeof message !== 'object' || message === null) return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
            ? ((part as { text: string }).text)
            : '',
      )
      .join('');
  }
  return '';
}

function readUsage(body: unknown): LlmUsage {
  const usage =
    typeof body === 'object' && body !== null ? (body as { usage?: unknown }).usage : undefined;
  if (typeof usage !== 'object' || usage === null) return { tokensIn: 0, tokensOut: 0 };
  const u = usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
  return {
    tokensIn: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
    tokensOut: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
  };
}

export class LlmClient {
  private readonly fetchImpl: typeof fetch;
  private readonly logger: LlmLogger;
  private readonly now: () => number;

  constructor(options: LlmClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.logger = options.logger ?? NOOP_LOGGER;
    this.now = options.now ?? (() => Date.now());
  }

  async complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    const { provider, model, apiKey, messages, schema, maxTokens, temperature, purpose, timeoutMs } =
      request;
    const config = PROVIDERS[provider];
    const started = this.now();

    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
      temperature,
    };
    // SPEC-03 §1: `response_format` cuando el proveedor lo soporta; la instrucción de
    // JSON va siempre además en el prompt.
    if (config.supportsJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // Nunca se registran ni la key ni el contenido de los mensajes.
    this.logger.debug('llm.request', { provider, model, purpose, messages: messages.length });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(provider, apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const latencyMs = this.now() - started;
      const aborted = controller.signal.aborted || (error as { name?: string })?.name === 'AbortError';
      const status: LlmErrorStatus = aborted ? 'timeout' : 'provider_error';
      this.logger.warn('llm.transport_error', { provider, model, purpose, status, latencyMs });
      throw new LlmCallError(
        status,
        provider,
        model,
        latencyMs,
        undefined,
        aborted
          ? `timeout tras ${timeoutMs} ms`
          : redact(clip(String((error as Error)?.message ?? error)), apiKey),
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const latencyMs = this.now() - started;
      const status = mapHttpStatus(response.status);
      const detail = redact(clip(await response.text().catch(() => '')), apiKey);
      this.logger.warn('llm.http_error', {
        provider,
        model,
        purpose,
        status,
        httpStatus: response.status,
        latencyMs,
      });
      throw new LlmCallError(status, provider, model, latencyMs, response.status, detail);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      const latencyMs = this.now() - started;
      throw new LlmCallError('invalid_json', provider, model, latencyMs, response.status, 'cuerpo no es JSON');
    }

    const latencyMs = this.now() - started;
    const usage = readUsage(payload);
    const choices = (payload as { choices?: unknown }).choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const content = readContent(
      typeof first === 'object' && first !== null ? (first as { message?: unknown }).message : undefined,
    );

    const extracted = extractFirstJsonObject(content);
    if (extracted === null) {
      this.logger.warn('llm.invalid_json', { provider, model, purpose, reason: 'no_json', latencyMs });
      throw new LlmCallError('invalid_json', provider, model, latencyMs, response.status, 'sin objeto JSON');
    }

    const parsed = schema.safeParse(extracted);
    if (!parsed.success) {
      this.logger.warn('llm.invalid_json', { provider, model, purpose, reason: 'schema', latencyMs });
      throw new LlmCallError(
        'invalid_json',
        provider,
        model,
        latencyMs,
        response.status,
        clip(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')),
      );
    }

    this.logger.debug('llm.ok', { provider, model, purpose, latencyMs, ...usage });
    return { data: parsed.data, usage, latencyMs, model, provider };
  }
}
