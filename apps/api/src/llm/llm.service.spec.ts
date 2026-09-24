import { APICallError } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';

import {
  LlmService,
  LlmUnavailableError,
  mapError,
  type CredentialErrorEvent,
  type LlmCallRecord,
  type LlmCallSink,
  type LlmEventBus,
} from './llm.service.js';
import { ModelResolver } from './model-resolver.js';
import { TurnOutput } from './schemas.js';

const FALLBACKS = [
  { provider: '9router' as const, model: 'fluent-pro' },
  { provider: '9router' as const, model: 'fluent-free' },
  { provider: '9router' as const, model: 'cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
];

const REPLY = { reply: 'Nice! What happened next?', corrections: [] };

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 30, text: 30, reasoning: undefined },
};

const FINISH = { unified: 'stop' as const, raw: 'stop' };

/** Qué hace el mock en cada llamada: texto que devuelve el modelo o error que lanza. */
type Step = string | Error | 'hang';

function generateStep(step: Step) {
  return async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
    if (step === 'hang') return hang(abortSignal);
    if (step instanceof Error) throw step;
    return {
      content: [{ type: 'text' as const, text: step }],
      finishReason: FINISH,
      usage: USAGE,
      warnings: [],
    };
  };
}

/** Trocea el texto en `chunkSize` para que `partialObjectStream` vaya soltando parciales. */
function streamStep(step: Step, chunkSize = 8) {
  return async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
    if (step === 'hang') return hang(abortSignal);
    if (step instanceof Error) throw step;
    const deltas: string[] = [];
    for (let i = 0; i < step.length; i += chunkSize) deltas.push(step.slice(i, i + chunkSize));
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          ...deltas.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end' as const, id: 't' },
          { type: 'finish' as const, finishReason: FINISH, usage: USAGE },
        ],
      }),
    };
  };
}

function hang(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });
}

function httpError(statusCode: number): APICallError {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: 'https://router.test/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
  });
}

/** Un mock por llamada, en orden; guarda el modelo pedido y las opciones que recibió. */
function scriptedProvider(steps: readonly Step[]) {
  const calls: Array<{ model: string; providerOptions: unknown }> = [];
  let index = 0;
  const provider = (model: string) => {
    const step = steps[index++];
    if (step === undefined) throw new Error('el proveedor falso se quedó sin guion');
    const record = (options: { providerOptions?: unknown }) =>
      void calls.push({ model, providerOptions: options.providerOptions });
    const generate = generateStep(step);
    const stream = streamStep(step);
    return new MockLanguageModelV3({
      modelId: model,
      doGenerate: async (options) => {
        record(options);
        return generate(options);
      },
      doStream: async (options) => {
        record(options);
        return stream(options);
      },
    });
  };
  return { provider, calls };
}

function memorySink(): LlmCallSink & { rows: LlmCallRecord[] } {
  const rows: LlmCallRecord[] = [];
  return { rows, record: (call) => void rows.push(call) };
}

function memoryBus(): LlmEventBus & { events: CredentialErrorEvent[] } {
  const events: CredentialErrorEvent[] = [];
  return { events, emit: (_name, payload) => void events.push(payload) };
}

function service(steps: readonly Step[], extra: { sink?: LlmCallSink; events?: LlmEventBus } = {}) {
  const { provider, calls } = scriptedProvider(steps);
  return {
    calls,
    service: new LlmService({
      provider,
      resolver: new ModelResolver(FALLBACKS),
      sink: extra.sink,
      events: extra.events,
    }),
  };
}

function request() {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    purpose: 'turn' as const,
    messages: [{ role: 'system' as const, content: 'You are Fluent.' }],
    schema: TurnOutput,
    plan: 'pro' as const,
    promptVersion: '1',
  };
}

const OK = JSON.stringify(REPLY);

describe('LlmService.complete', () => {
  it('sin streaming responde con el primer candidato y registra el intento', async () => {
    const sink = memorySink();
    const { service: svc, calls } = service([OK], { sink });

    const result = await svc.complete(request());

    expect(result.data).toEqual(REPLY);
    expect(result.modelUsed).toBe('fluent-pro');
    expect(result.provider).toBe('9router');
    expect(result.degraded).toBe(false);
    expect(result.usage).toEqual({ tokensIn: 100, tokensOut: 30 });
    expect(calls[0]?.providerOptions).toEqual({ '9router': { reasoningEffort: 'none' } });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      purpose: 'turn',
      provider: '9router',
      model: 'fluent-pro',
      status: 'ok',
      attempt: 1,
      promptVersion: '1',
      tokensIn: 100,
      tokensOut: 30,
    });
  });

  it('repara el JSON envuelto en vallas ```json', async () => {
    const { service: svc } = service(['```json\n' + OK + '\n```']);

    const result = await svc.complete(request());

    expect(result.data).toEqual(REPLY);
    expect(result.attempts).toHaveLength(1);
  });

  it('con streaming emite los deltas de reply en orden', async () => {
    const { service: svc } = service([OK]);
    const tokens: string[] = [];

    const result = await svc.complete({ ...request(), onToken: (delta) => tokens.push(delta) });

    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join('')).toBe(REPLY.reply);
    expect(result.data).toEqual(REPLY);
    expect(result.usage).toEqual({ tokensIn: 100, tokensOut: 30 });
  });

  it('invalid_json cae al siguiente candidato y avisa con onReset si ya había emitido', async () => {
    const sink = memorySink();
    // Empieza bien (emite parte de reply) y luego no cumple el esquema.
    const broken = JSON.stringify({ reply: 'Half a sentence', corrections: 'no' });
    const { service: svc, calls } = service([broken, OK], { sink });
    const events: string[] = [];

    const result = await svc.complete({
      ...request(),
      onToken: () => events.push('token'),
      onReset: () => events.push('reset'),
    });

    expect(calls.map((c) => c.model)).toEqual(['fluent-pro', 'fluent-free']);
    expect(result.degraded).toBe(true);
    expect(result.attempts.map((a) => a.status)).toEqual(['invalid_json', 'ok']);
    expect(sink.rows.map((r) => [r.attempt, r.status])).toEqual([
      [1, 'invalid_json'],
      [2, 'ok'],
    ]);
    expect(events.filter((e) => e === 'reset')).toHaveLength(1);
    expect(events.indexOf('reset')).toBeGreaterThan(0);
    expect(events.at(-1)).toBe('token');
  });

  it('sin streaming nunca llama a onReset', async () => {
    const { service: svc } = service(['no json at all', OK]);
    let resets = 0;

    await svc.complete({ ...request(), onReset: () => (resets += 1) });

    expect(resets).toBe(0);
  });

  it('429 se registra como rate_limited y pasa al siguiente', async () => {
    const sink = memorySink();
    const { service: svc } = service([httpError(429), OK], { sink });

    const result = await svc.complete(request());

    expect(result.modelUsed).toBe('fluent-free');
    expect(sink.rows.map((r) => r.status)).toEqual(['rate_limited', 'ok']);
    expect(sink.rows[0]).toMatchObject({ tokensIn: null, tokensOut: null });
  });

  it('401 emite credential.error y descarta el proveedor', async () => {
    const bus = memoryBus();
    const { service: svc, calls } = service([httpError(401), OK], { events: bus });

    await expect(svc.complete(request())).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(bus.events).toEqual([{ userId: 'user-1', provider: '9router', code: 'AUTH_ERROR' }]);
    expect(calls).toHaveLength(1);
  });

  it('timeout aborta el intento y lo registra como timeout', async () => {
    const sink = memorySink();
    const { service: svc } = service(['hang', OK], { sink });

    const result = await svc.complete({ ...request(), timeoutMs: 20 });

    expect(result.modelUsed).toBe('fluent-free');
    expect(sink.rows.map((r) => r.status)).toEqual(['timeout', 'ok']);
  });

  it('cadena agotada termina en LlmUnavailableError con cada intento registrado', async () => {
    const sink = memorySink();
    const { service: svc, calls } = service(
      [httpError(500), 'nope', httpError(429), OK],
      { sink },
    );

    const error = (await svc.complete(request()).catch((e: unknown) => e)) as LlmUnavailableError;

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect(error.code).toBe('LLM_UNAVAILABLE');
    expect(calls).toHaveLength(3);
    expect(error.attempts.map((a) => a.status)).toEqual([
      'provider_error',
      'invalid_json',
      'rate_limited',
    ]);
    expect(sink.rows.map((r) => r.attempt)).toEqual([1, 2, 3]);
  });

  it('plan free solo prueba fluent-free y marca degradado si había preferencia', async () => {
    const { service: svc, calls } = service([OK]);

    const result = await svc.complete({
      ...request(),
      plan: 'free',
      preference: { provider: '9router', model: 'fluent-pro' },
    });

    expect(calls.map((c) => c.model)).toEqual(['fluent-free']);
    expect(result.degraded).toBe(true);
  });
});

describe('mapError', () => {
  it('traduce los errores del SDK según la tabla de la arquitectura', () => {
    expect(mapError(httpError(401))).toBe('auth_error');
    expect(mapError(httpError(403))).toBe('auth_error');
    expect(mapError(httpError(429))).toBe('rate_limited');
    expect(mapError(httpError(400))).toBe('provider_error');
    expect(mapError(new DOMException('t', 'TimeoutError'))).toBe('timeout');
    expect(mapError(new Error('boom'), true)).toBe('timeout');
    expect(mapError(new Error('boom'))).toBe('provider_error');
  });
});
