import { LlmCallError, LlmClient, type LlmLogger, type LlmMessage } from './llm.client.js';
import { PROVIDERS } from './config.js';
import { TurnOutput } from './schemas.js';

const API_KEY = 'sk-or-v1-SUPERSECRETA-0123456789';

const MESSAGES: LlmMessage[] = [
  { role: 'system', content: 'You are Fluent.' },
  { role: 'user', content: 'I go to gym yesterday.' },
];

function baseRequest() {
  return {
    provider: 'openrouter' as const,
    model: 'google/gemma-3-27b-it:free',
    apiKey: API_KEY,
    messages: MESSAGES,
    schema: TurnOutput,
    maxTokens: 350,
    temperature: 0.7,
    purpose: 'turn' as const,
    timeoutMs: 25_000,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function chatCompletion(content: string, usage = { prompt_tokens: 120, completion_tokens: 40 }) {
  return {
    id: 'gen-1',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage,
  };
}

const VALID_CONTENT = JSON.stringify({
  reply: 'Nice! What did you do at the gym?',
  corrections: [
    {
      original: 'I go to gym yesterday',
      corrected: 'I went to the gym yesterday',
      category: 'past_simple',
      note: 'Usa el pasado simple para acciones terminadas.',
    },
  ],
});

/** Logger que guarda todo lo que se le pasa para poder auditarlo. */
function recordingLogger(): { logger: LlmLogger; dump: () => string } {
  const lines: unknown[] = [];
  const push = (message: string, meta?: Record<string, unknown>) => lines.push([message, meta]);
  return {
    logger: { debug: push, warn: push },
    dump: () => JSON.stringify(lines),
  };
}

describe('LlmClient.complete', () => {
  it('devuelve datos validados, uso y latencia con una respuesta 200 correcta', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse(chatCompletion(VALID_CONTENT));
    }) as unknown as typeof fetch;

    let clock = 1000;
    const client = new LlmClient({
      fetchImpl,
      now: () => {
        const value = clock;
        clock += 640;
        return value;
      },
    });

    const result = await client.complete(baseRequest());

    expect(seenUrl).toBe(`${PROVIDERS.openrouter.baseUrl}/chat/completions`);
    expect(result.data.reply).toBe('Nice! What did you do at the gym?');
    expect(result.data.corrections[0]?.category).toBe('past_simple');
    expect(result.usage).toEqual({ tokensIn: 120, tokensOut: 40 });
    expect(result.latencyMs).toBe(640);
    expect(result.model).toBe('google/gemma-3-27b-it:free');
    expect(result.provider).toBe('openrouter');

    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers['HTTP-Referer']).toBe('https://fluent.app');
    expect(headers['X-Title']).toBe('Fluent');

    const body = JSON.parse(String(seenInit?.body)) as Record<string, unknown>;
    expect(body.model).toBe('google/gemma-3-27b-it:free');
    expect(body.max_tokens).toBe(350);
    expect(body.temperature).toBe(0.7);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('usa la baseUrl y las cabeceras de Gemini sin extras', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse(chatCompletion(VALID_CONTENT));
    }) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    await client.complete({ ...baseRequest(), provider: 'gemini', model: 'gemini-2.5-flash' });

    expect(seenUrl).toBe(`${PROVIDERS.gemini.baseUrl}/chat/completions`);
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['X-Title']).toBeUndefined();
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('acepta contenido troceado en partes', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: '{"reply": "Hi!",' }, { type: 'text', text: ' "corrections": []}' }],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    const result = await client.complete(baseRequest());
    expect(result.data).toEqual({ reply: 'Hi!', corrections: [] });
  });

  it('mapea 200 con JSON roto a invalid_json', async () => {
    const fetchImpl = (async () =>
      jsonResponse(chatCompletion("Sure! {'reply': 'broken'}"))) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    await expect(client.complete(baseRequest())).rejects.toMatchObject({
      name: 'LlmCallError',
      status: 'invalid_json',
    });
  });

  it('mapea 200 que no cumple el esquema a invalid_json', async () => {
    const fetchImpl = (async () =>
      jsonResponse(chatCompletion('{"corrections": []}'))) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    await expect(client.complete(baseRequest())).rejects.toMatchObject({ status: 'invalid_json' });
  });

  it.each([
    [401, 'auth_error'],
    [403, 'auth_error'],
    [402, 'no_credits'],
    [429, 'rate_limited'],
    [500, 'provider_error'],
    [502, 'provider_error'],
    [400, 'provider_error'],
  ])('mapea el HTTP %i a %s', async (httpStatus, expected) => {
    const fetchImpl = (async () =>
      new Response('{"error":{"message":"nope"}}', { status: httpStatus })) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    const error = await client.complete(baseRequest()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmCallError);
    expect((error as LlmCallError).status).toBe(expected);
    expect((error as LlmCallError).httpStatus).toBe(httpStatus);
  });

  it('marca como error de credencial solo 401, 403 y 402', async () => {
    const build = (status: number) =>
      new LlmCallError(status === 402 ? 'no_credits' : 'auth_error', 'openrouter', 'm', 10, status);
    expect(build(401).isCredentialError).toBe(true);
    expect(build(402).isCredentialError).toBe(true);
    expect(new LlmCallError('rate_limited', 'openrouter', 'm', 10, 429).isCredentialError).toBe(false);
  });

  it('aborta con AbortController y devuelve timeout', async () => {
    const fetchImpl = ((_url: string | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      })) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    const error = await client
      .complete({ ...baseRequest(), timeoutMs: 20 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmCallError);
    expect((error as LlmCallError).status).toBe('timeout');
  });

  it('mapea un fallo de red a provider_error', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    await expect(client.complete(baseRequest())).rejects.toMatchObject({ status: 'provider_error' });
  });

  it('nunca registra ni expone la API key', async () => {
    const scenarios: Array<() => Response | Promise<Response>> = [
      () => jsonResponse(chatCompletion(VALID_CONTENT)),
      () => jsonResponse(chatCompletion('no hay json aqui')),
      () => new Response(`{"error":"invalid key ${API_KEY}"}`, { status: 401 }),
      () => new Response('boom', { status: 500 }),
    ];

    for (const scenario of scenarios) {
      const { logger, dump } = recordingLogger();
      const fetchImpl = (async () => scenario()) as unknown as typeof fetch;
      const client = new LlmClient({ fetchImpl, logger });

      const outcome = await client.complete(baseRequest()).then(
        (value) => JSON.stringify(value),
        (error: unknown) =>
          JSON.stringify({
            message: (error as Error).message,
            detail: (error as LlmCallError).detail,
            serialized: JSON.stringify(error),
            stack: (error as Error).stack,
          }),
      );

      expect(dump()).not.toContain(API_KEY);
      expect(dump()).not.toContain('Bearer');
      expect(outcome).not.toContain(API_KEY);
    }
  });

  it('no filtra la key aunque el proveedor la devuelva en el cuerpo del error', async () => {
    const fetchImpl = (async () =>
      new Response(`{"error":"bad key ${API_KEY}"}`, { status: 401 })) as unknown as typeof fetch;

    const client = new LlmClient({ fetchImpl });
    const error = (await client.complete(baseRequest()).catch((e: unknown) => e)) as LlmCallError;

    // El detalle viene del proveedor: se redacta antes de guardarlo.
    expect(error.detail ?? '').not.toContain(API_KEY);
    expect(error.detail ?? '').toContain('[REDACTED]');
  });
});
