import { LlmCallError, type LlmResult } from './llm.client.js';
import {
  LlmService,
  LlmUnavailableError,
  type CredentialErrorEvent,
  type LlmCallRecord,
  type LlmCallSink,
  type LlmEventBus,
} from './llm.service.js';
import { ModelResolver, type ActiveCredential } from './model-resolver.js';
import { TurnOutput } from './schemas.js';

const FALLBACKS = [
  { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
  { provider: 'openrouter' as const, model: 'google/gemma-3-27b-it:free' },
  { provider: 'openrouter' as const, model: 'meta-llama/llama-3.3-70b-instruct:free' },
];

const CREDENTIALS: ActiveCredential[] = [
  { provider: 'openrouter', apiKey: 'or-key' },
  { provider: 'gemini', apiKey: 'gem-key' },
];

const REPLY = { reply: 'Nice! What happened next?', corrections: [] };

function okResult(model: string, provider: 'openrouter' | 'gemini'): LlmResult<typeof REPLY> {
  return {
    data: REPLY,
    usage: { tokensIn: 100, tokensOut: 30 },
    latencyMs: 500,
    model,
    provider,
  };
}

/** Recolector en memoria de `llm_calls` (PR-02 lo implementará con InsForge). */
function memorySink(): LlmCallSink & { rows: LlmCallRecord[] } {
  const rows: LlmCallRecord[] = [];
  return { rows, record: (call) => void rows.push(call) };
}

function memoryBus(): LlmEventBus & { events: CredentialErrorEvent[] } {
  const events: CredentialErrorEvent[] = [];
  return { events, emit: (_name, payload) => void events.push(payload) };
}

/**
 * Cliente falso que va consumiendo respuestas o errores en orden.
 *
 * `emitBeforeEach` deja que cada intento emita texto por `onToken` antes de
 * resolverse o fallar, que es lo que hace falta para probar el `reset` de
 * MAL-22: el problema solo aparece cuando el intento fallido ya pintó algo.
 */
function scriptedClient(
  script: Array<LlmResult<typeof REPLY> | LlmCallError>,
  emitBeforeEach: readonly string[] = [],
) {
  const calls: Array<{ provider: string; model: string; apiKey: string }> = [];
  let index = 0;
  return {
    calls,
    client: {
      complete: (async (request: {
        provider: string;
        model: string;
        apiKey: string;
        onToken?: (delta: string) => void;
      }) => {
        calls.push({ provider: request.provider, model: request.model, apiKey: request.apiKey });
        const emit = emitBeforeEach[index];
        if (emit !== undefined && request.onToken) request.onToken(emit);
        const next = script[index++];
        if (next === undefined) throw new Error('el cliente falso se quedó sin guion');
        if (next instanceof LlmCallError) throw next;
        return next;
      }) as never,
    },
  };
}

function service(
  script: Array<LlmResult<typeof REPLY> | LlmCallError>,
  extra: {
    sink?: LlmCallSink;
    events?: LlmEventBus;
    emitBeforeEach?: readonly string[];
  } = {},
) {
  const { client, calls } = scriptedClient(script, extra.emitBeforeEach);
  return {
    calls,
    service: new LlmService({
      client,
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
    credentials: CREDENTIALS,
    promptVersion: '1',
  };
}

describe('LlmService.complete', () => {
  it('responde con el primer candidato sin degradar', async () => {
    const sink = memorySink();
    const { service: svc } = service([okResult('mi/modelo', 'openrouter')], { sink });

    const result = await svc.complete({
      ...request(),
      preference: { provider: 'openrouter', model: 'mi/modelo' },
    });

    expect(result.modelUsed).toBe('mi/modelo');
    expect(result.degraded).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.usage).toEqual({ tokensIn: 100, tokensOut: 30 });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      purpose: 'turn',
      status: 'ok',
      attempt: 1,
      promptVersion: '1',
      tokensIn: 100,
      tokensOut: 30,
    });
  });

  it('402 en el modelo pago del usuario: pasa al siguiente gratuito y emite credential.error', async () => {
    const sink = memorySink();
    const bus = memoryBus();
    const { service: svc, calls } = service(
      [
        new LlmCallError('no_credits', 'openrouter', 'openai/gpt-4o', 210, 402),
        okResult('gemini-2.5-flash', 'gemini'),
      ],
      { sink, events: bus },
    );

    const result = await svc.complete({
      ...request(),
      preference: { provider: 'openrouter', model: 'openai/gpt-4o' },
    });

    expect(result.modelUsed).toBe('gemini-2.5-flash');
    expect(result.provider).toBe('gemini');
    expect(result.degraded).toBe(true);
    expect(result.attempts.map((a) => a.status)).toEqual(['no_credits', 'ok']);

    expect(bus.events).toEqual([
      { userId: 'user-1', provider: 'openrouter', code: 'NO_CREDITS' },
    ]);

    // Tras el 402 no se vuelve a intentar con OpenRouter: se salta a Gemini.
    expect(calls.map((c) => c.provider)).toEqual(['openrouter', 'gemini']);
    expect(sink.rows.map((r) => r.status)).toEqual(['no_credits', 'ok']);
    expect(sink.rows[0]).toMatchObject({ tokensIn: null, tokensOut: null, latencyMs: 210 });
  });

  it('401 emite credential.error con AUTH_ERROR y descarta el proveedor', async () => {
    const bus = memoryBus();
    const { service: svc, calls } = service(
      [
        new LlmCallError('auth_error', 'gemini', 'gemini-2.5-flash', 90, 401),
        okResult('google/gemma-3-27b-it:free', 'openrouter'),
      ],
      { events: bus },
    );

    const result = await svc.complete(request());

    expect(bus.events).toEqual([{ userId: 'user-1', provider: 'gemini', code: 'AUTH_ERROR' }]);
    expect(calls.map((c) => c.provider)).toEqual(['gemini', 'openrouter']);
    expect(result.modelUsed).toBe('google/gemma-3-27b-it:free');
  });

  it('JSON inválido dos veces y válido a la tercera devuelve degraded true', async () => {
    const sink = memorySink();
    const { service: svc } = service(
      [
        new LlmCallError('invalid_json', 'gemini', 'gemini-2.5-flash', 700, 200),
        new LlmCallError('invalid_json', 'openrouter', 'google/gemma-3-27b-it:free', 800, 200),
        okResult('meta-llama/llama-3.3-70b-instruct:free', 'openrouter'),
      ],
      { sink },
    );

    const result = await svc.complete(request());

    expect(result.degraded).toBe(true);
    expect(result.modelUsed).toBe('meta-llama/llama-3.3-70b-instruct:free');
    expect(result.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(sink.rows.map((r) => r.status)).toEqual(['invalid_json', 'invalid_json', 'ok']);
    expect(sink.rows.map((r) => r.attempt)).toEqual([1, 2, 3]);
  });

  it('degrada también si la preferencia se descarta por falta de credencial', async () => {
    const { service: svc } = service([okResult('gemini-2.5-flash', 'gemini')]);

    const result = await svc.complete({
      ...request(),
      credentials: [{ provider: 'gemini', apiKey: 'gem-key' }],
      preference: { provider: 'openrouter', model: 'openai/gpt-4o' },
    });

    expect(result.degraded).toBe(true);
    expect(result.attempts).toHaveLength(1);
  });

  it('nunca hace más de 3 intentos y termina en LLM_UNAVAILABLE', async () => {
    const sink = memorySink();
    const { service: svc, calls } = service(
      [
        new LlmCallError('rate_limited', 'gemini', 'gemini-2.5-flash', 50, 429),
        new LlmCallError('provider_error', 'openrouter', 'google/gemma-3-27b-it:free', 60, 500),
        new LlmCallError('timeout', 'openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 25_000),
        okResult('nunca-se-usa', 'openrouter'),
      ],
      { sink },
    );

    const error = (await svc.complete(request()).catch((e: unknown) => e)) as LlmUnavailableError;

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect(error.code).toBe('LLM_UNAVAILABLE');
    expect(calls).toHaveLength(3);
    expect(error.attempts.map((a) => a.status)).toEqual([
      'rate_limited',
      'provider_error',
      'timeout',
    ]);
    expect(sink.rows).toHaveLength(3);
  });

  it('sin credenciales falla con LLM_UNAVAILABLE y sin ninguna llamada HTTP', async () => {
    const sink = memorySink();
    const { service: svc, calls } = service([okResult('x', 'openrouter')], { sink });

    const error = (await svc
      .complete({ ...request(), credentials: [] })
      .catch((e: unknown) => e)) as LlmUnavailableError;

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect(error.code).toBe('LLM_UNAVAILABLE');
    expect(error.attempts).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(sink.rows).toEqual([]);
  });

  it('convierte un error inesperado del cliente en provider_error registrado', async () => {
    const sink = memorySink();
    const { client } = scriptedClient([]);
    const svc = new LlmService({
      client: { complete: (async () => { throw new Error('boom'); }) as never },
      resolver: new ModelResolver([FALLBACKS[0]!]),
      sink,
    });
    void client;

    await expect(svc.complete(request())).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(sink.rows.map((r) => r.status)).toEqual(['provider_error']);
  });

  it('pasa a cada candidato la key de su proveedor', async () => {
    const { service: svc, calls } = service([
      new LlmCallError('invalid_json', 'gemini', 'gemini-2.5-flash', 10, 200),
      okResult('google/gemma-3-27b-it:free', 'openrouter'),
    ]);

    await svc.complete(request());

    expect(calls).toEqual([
      { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'gem-key' },
      { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', apiKey: 'or-key' },
    ]);
  });
});

describe('LlmService.complete · reset al cambiar de modelo (MAL-22)', () => {
  it('avisa antes de reintentar si el intento fallido ya emitió texto', async () => {
    const { service: svc } = service(
      [new LlmCallError('invalid_json', 'openrouter', 'm1', 400), okResult('gemini-2.5-flash', 'gemini')],
      { emitBeforeEach: ['Nice! What', 'Great! How'] },
    );

    const tokens: string[] = [];
    const events: string[] = [];

    await svc.complete({
      ...request(),
      onToken: (delta) => {
        tokens.push(delta);
        events.push(`token:${delta}`);
      },
      onReset: () => events.push('reset'),
    });

    // Sin el aviso, la app pegaba el texto del intento fallido al del bueno.
    expect(events).toEqual(['token:Nice! What', 'reset', 'token:Great! How']);
  });

  it('no avisa si el intento fallido no llegó a emitir nada', async () => {
    const { service: svc } = service(
      [new LlmCallError('timeout', 'openrouter', 'm1', 408), okResult('gemini-2.5-flash', 'gemini')],
      { emitBeforeEach: [] },
    );

    let resets = 0;
    await svc.complete({
      ...request(),
      onToken: () => {},
      onReset: () => {
        resets += 1;
      },
    });

    expect(resets).toBe(0);
  });

  it('no avisa cuando el primer intento va bien', async () => {
    const { service: svc } = service([okResult('gemini-2.5-flash', 'gemini')], { emitBeforeEach: ['Hello'] });

    let resets = 0;
    await svc.complete({
      ...request(),
      onToken: () => {},
      onReset: () => {
        resets += 1;
      },
    });

    expect(resets).toBe(0);
  });

  it('sin streaming no se avisa nunca, aunque haya fallback', async () => {
    const { service: svc } = service([
      new LlmCallError('invalid_json', 'openrouter', 'm1', 400),
      okResult('gemini-2.5-flash', 'gemini'),
    ]);

    let resets = 0;
    await svc.complete({ ...request(), onReset: () => { resets += 1; } });

    expect(resets).toBe(0);
  });
});
