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
import { StreamReplyParser } from './stream-reply-parser.js';

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
  /**
   * Streaming (SPEC-04 §4, RF-3.8). Si viene, la petición se hace con
   * `stream: true` y se llama con cada *delta* del campo `reply` según llega
   * (ver `StreamReplyParser`). El resultado, la validación y los errores son
   * **exactamente** los mismos que sin streaming: `onToken` solo adelanta
   * texto, nunca cambia lo que devuelve `complete`.
   */
  readonly onToken?: (delta: string) => void;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      return await this.send(request, controller);
    } finally {
      // El temporizador tiene que cubrir también la lectura del cuerpo: en
      // streaming la respuesta HTTP llega en cuanto empieza el primer token,
      // pero la llamada no termina hasta el último trozo, así que
      // `timeoutMs` (SPEC-03 §2) se aplica a la llamada entera.
      clearTimeout(timer);
    }
  }

  private async send<T>(
    request: LlmRequest<T>,
    controller: AbortController,
  ): Promise<LlmResult<T>> {
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
    // SPEC-04 §4 «Streaming»: el único cambio en la petición es `stream: true`
    // (no se manda `stream_options`, ver PEND-53).
    const streaming = request.onToken !== undefined;
    if (streaming) {
      body.stream = true;
    }

    // Nunca se registran ni la key ni el contenido de los mensajes.
    this.logger.debug('llm.request', { provider, model, purpose, streaming, messages: messages.length });

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

    let content: string;
    let usage: LlmUsage;

    if (streaming) {
      // El cuerpo llega troceado: se acumula entero y se valida igual que
      // abajo. `onToken` solo ha ido adelantando el texto de `reply`.
      const stream = await this.readStream(request, response, controller, started);
      content = stream.content;
      usage = stream.usage;
    } else {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        const latencyMs = this.now() - started;
        throw new LlmCallError('invalid_json', provider, model, latencyMs, response.status, 'cuerpo no es JSON');
      }

      usage = readUsage(payload);
      const choices = (payload as { choices?: unknown }).choices;
      const first = Array.isArray(choices) ? choices[0] : undefined;
      content = readContent(
        typeof first === 'object' && first !== null ? (first as { message?: unknown }).message : undefined,
      );
    }

    const latencyMs = this.now() - started;

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

  /**
   * Lee el cuerpo SSE de una respuesta con `stream: true` (SPEC-04 §4).
   *
   * Devuelve el texto acumulado de `choices[0].delta.content` —que se valida
   * después **exactamente igual** que en el modo no streaming— y el `usage`
   * que el proveedor haya mandado (ceros si no manda ninguno, PEND-53).
   *
   * Mientras acumula alimenta un `StreamReplyParser` y llama a `onToken` con
   * cada delta del campo `reply`. Si el parser no reconoce la estructura deja
   * de emitir y no pasa nada más: el texto completo sigue acumulándose.
   */
  private async readStream<T>(
    request: LlmRequest<T>,
    response: Response,
    controller: AbortController,
    started: number,
  ): Promise<{ content: string; usage: LlmUsage }> {
    const { provider, model, purpose, apiKey, timeoutMs, onToken } = request;

    const stream = response.body;
    if (stream === null) {
      throw new LlmCallError(
        'invalid_json',
        provider,
        model,
        this.now() - started,
        response.status,
        'respuesta de streaming sin cuerpo',
      );
    }

    const parser = new StreamReplyParser();
    const decoder = new TextDecoder();
    const reader = stream.getReader();

    let content = '';
    let usage: LlmUsage = { tokensIn: 0, tokensOut: 0 };
    /** Resto de la última línea, que puede venir partida entre dos trozos. */
    let pending = '';
    /** Líneas `data:` del evento en curso (SSE permite varias por evento). */
    let dataLines: string[] = [];
    let finished = false;
    /**
     * El destino de los tokens es la respuesta HTTP del endpoint SSE: si el
     * cliente cuelga, `write` lanza. Se deja de emitir, pero la llamada al
     * modelo sigue hasta el final para poder persistir el turno.
     */
    let sinkBroken = false;

    const emit = (delta: string): void => {
      if (delta === '' || sinkBroken || onToken === undefined) return;
      try {
        onToken(delta);
      } catch {
        sinkBroken = true;
        this.logger.warn('llm.stream_sink_error', { provider, model, purpose });
      }
    };

    /** Procesa el `data:` completo de un evento SSE. */
    const handleData = (data: string): void => {
      if (data === '') return;
      if (data === '[DONE]') {
        finished = true;
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        // Trozo que no es JSON (o cortado): se ignora. Si con eso el texto
        // acumulado no llega a ser un objeto válido, la validación de abajo
        // devuelve `invalid_json`, igual que en el modo no streaming.
        return;
      }

      const error = (payload as { error?: unknown }).error;
      if (error !== undefined && error !== null) {
        // Algunos proveedores mandan el error dentro del stream, ya con un 200.
        throw new LlmCallError(
          'provider_error',
          provider,
          model,
          this.now() - started,
          response.status,
          redact(clip(JSON.stringify(error)), apiKey),
        );
      }

      const rawUsage = (payload as { usage?: unknown }).usage;
      if (typeof rawUsage === 'object' && rawUsage !== null) {
        usage = readUsage(payload);
      }

      const choices = (payload as { choices?: unknown }).choices;
      const first = Array.isArray(choices) ? choices[0] : undefined;
      if (typeof first !== 'object' || first === null) return;

      // `delta` en cada trozo; algunos proveedores mandan además un `message`
      // completo en el último, que se ignora para no duplicar el texto.
      const piece = readContent((first as { delta?: unknown }).delta);
      if (piece === '') return;

      content += piece;
      emit(parser.push(piece));
    };

    /** Consume las líneas completas que haya en `pending`. */
    const consumeLines = (): void => {
      for (;;) {
        const newline = pending.indexOf('\n');
        if (newline === -1) return;
        const line = pending.slice(0, newline).replace(/\r$/, '');
        pending = pending.slice(newline + 1);

        if (line === '') {
          // Línea en blanco: fin del evento.
          handleData(dataLines.join('\n'));
          dataLines = [];
        } else if (line.startsWith(':')) {
          // Comentario/keep-alive (por ejemplo `: OPENROUTER PROCESSING`).
          continue;
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
        }
        // El resto de campos SSE (`event:`, `id:`, `retry:`) no se usan.

        if (finished) return;
      }
    };

    try {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        pending +=
          typeof value === 'string' ? value : decoder.decode(value as Uint8Array, { stream: true });
        consumeLines();
      }

      if (!finished) {
        // Cierre sin `[DONE]`: se procesa lo que quede suelto (un stream
        // cortado dejará el JSON incompleto y acabará en `invalid_json`).
        pending += decoder.decode();
        pending += '\n';
        consumeLines();
        if (dataLines.length > 0) handleData(dataLines.join('\n'));
      }
    } catch (error) {
      if (error instanceof LlmCallError) throw error;
      const latencyMs = this.now() - started;
      const aborted = controller.signal.aborted || (error as { name?: string })?.name === 'AbortError';
      const status: LlmErrorStatus = aborted ? 'timeout' : 'provider_error';
      this.logger.warn('llm.stream_error', { provider, model, purpose, status, latencyMs });
      throw new LlmCallError(
        status,
        provider,
        model,
        latencyMs,
        response.status,
        aborted
          ? `timeout tras ${timeoutMs} ms`
          : redact(clip(String((error as Error)?.message ?? error)), apiKey),
      );
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Cerrar el lector nunca puede tapar el error real de la llamada.
      }
    }

    emit(parser.end());

    return { content, usage };
  }
}
