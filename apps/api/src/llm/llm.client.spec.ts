import { LlmCallError, LlmClient, type LlmLogger, type LlmMessage } from './llm.client.js';
import { LEGACY_PROVIDERS as PROVIDERS } from './config.js';
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

// ---------------------------------------------------------------------------
// Streaming (SPEC-04 §4, RF-3.8) — PR-04/T4
// ---------------------------------------------------------------------------

/** Respuesta HTTP con un cuerpo SSE hecho de los trozos dados, en orden. */
function sseResponse(chunks: readonly string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** Evento SSE con un delta de contenido, como lo manda un proveedor compatible con OpenAI. */
function deltaEvent(content: string): string {
  return `data: ${JSON.stringify({
    id: 'gen-1',
    choices: [{ index: 0, delta: { content } }],
  })}\n\n`;
}

/** Trocea un texto en piezas de `size` caracteres. */
function slice(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const STREAM_REPLY = 'Nice! What did you do at the gym? 😀';
const STREAM_CONTENT = JSON.stringify({
  reply: STREAM_REPLY,
  corrections: [
    {
      original: 'I go to gym yesterday',
      corrected: 'I went to the gym yesterday',
      category: 'past_simple',
      note: 'Usa el pasado simple.',
    },
  ],
});

describe('LlmClient.complete · streaming', () => {
  it('pide `stream: true` y emite los deltas de `reply` en orden', async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      seenInit = init;
      return sseResponse([
        ...slice(STREAM_CONTENT, 7).map(deltaEvent),
        `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 40 } })}\n\n`,
        'data: [DONE]\n\n',
      ]);
    }) as unknown as typeof fetch;

    const tokens: string[] = [];
    const client = new LlmClient({ fetchImpl });
    const result = await client.complete({
      ...baseRequest(),
      onToken: (delta) => tokens.push(delta),
    });

    const body = JSON.parse(String(seenInit?.body)) as Record<string, unknown>;
    expect(body.stream).toBe(true);
    // El resultado validado es exactamente el del modo no streaming.
    expect(result.data.reply).toBe(STREAM_REPLY);
    expect(result.data.corrections[0]?.category).toBe('past_simple');
    expect(result.usage).toEqual({ tokensIn: 120, tokensOut: 40 });
    // Los tokens llegan en orden y solo con el contenido de `reply`.
    expect(tokens.join('')).toBe(STREAM_REPLY);
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join('')).not.toContain('past_simple');
  });

  it('sin `onToken` la petición no lleva `stream`', async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      seenInit = init;
      return jsonResponse(chatCompletion(VALID_CONTENT));
    }) as unknown as typeof fetch;

    await new LlmClient({ fetchImpl }).complete(baseRequest());

    const body = JSON.parse(String(seenInit?.body)) as Record<string, unknown>;
    expect(body.stream).toBeUndefined();
  });

  it('reconstruye `reply` aunque los trozos HTTP partan los eventos SSE por cualquier sitio', async () => {
    const sse = [...slice(STREAM_CONTENT, 5).map(deltaEvent), 'data: [DONE]\n\n'].join('');

    for (const size of [1, 3, 17]) {
      const fetchImpl = (async () => sseResponse(slice(sse, size))) as unknown as typeof fetch;
      const tokens: string[] = [];
      const result = await new LlmClient({ fetchImpl }).complete({
        ...baseRequest(),
        onToken: (delta) => tokens.push(delta),
      });

      expect(tokens.join(''), `trozos de ${size}`).toBe(STREAM_REPLY);
      expect(result.data.reply).toBe(STREAM_REPLY);
    }
  });

  it('acepta `\\r\\n`, comentarios de keep-alive y eventos con nombre', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        ': OPENROUTER PROCESSING\r\n\r\n',
        ...slice(STREAM_CONTENT, 9).map((piece) => deltaEvent(piece).replace(/\n/g, '\r\n')),
        'event: done\r\ndata: [DONE]\r\n\r\n',
      ])) as unknown as typeof fetch;

    const tokens: string[] = [];
    const result = await new LlmClient({ fetchImpl }).complete({
      ...baseRequest(),
      onToken: (delta) => tokens.push(delta),
    });

    expect(tokens.join('')).toBe(STREAM_REPLY);
    expect(result.data.reply).toBe(STREAM_REPLY);
  });

  it('sin `usage` en el stream registra null, no ceros (MEJ-29)', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        ...slice(STREAM_CONTENT, 20).map(deltaEvent),
        'data: [DONE]\n\n',
      ])) as unknown as typeof fetch;

    const result = await new LlmClient({ fetchImpl }).complete({
      ...baseRequest(),
      onToken: () => {},
    });

    // Ceros sesgaban a la baja el coste estimado de `GET /models`: «no lo sé»
    // y «cero tokens» no son lo mismo.
    expect(result.usage).toEqual({ tokensIn: null, tokensOut: null });
  });

  it('pide stream_options.include_usage al abrir el stream (MEJ-29)', async () => {
    let sentBody: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return sseResponse([
        ...slice(STREAM_CONTENT, 20).map(deltaEvent),
        'data: [DONE]\n\n',
      ]);
    }) as unknown as typeof fetch;

    await new LlmClient({ fetchImpl }).complete({ ...baseRequest(), onToken: () => {} });

    expect(sentBody.stream).toBe(true);
    expect(sentBody.stream_options).toEqual({ include_usage: true });
  });

  it('no manda stream_options fuera del streaming (MEJ-29)', async () => {
    let sentBody: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        choices: [{ message: { content: STREAM_CONTENT } }],
        usage: { prompt_tokens: 7, completion_tokens: 3 },
      });
    }) as unknown as typeof fetch;

    const result = await new LlmClient({ fetchImpl }).complete(baseRequest());

    expect(sentBody.stream).toBeUndefined();
    expect(sentBody.stream_options).toBeUndefined();
    expect(result.usage).toEqual({ tokensIn: 7, tokensOut: 3 });
  });

  it('el usage que llega al final del stream se registra (MEJ-29)', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        ...slice(STREAM_CONTENT, 20).map(deltaEvent),
        `data: ${JSON.stringify({
          choices: [],
          usage: { prompt_tokens: 120, completion_tokens: 40 },
        })}\n\n`,
        'data: [DONE]\n\n',
      ])) as unknown as typeof fetch;

    const result = await new LlmClient({ fetchImpl }).complete({
      ...baseRequest(),
      onToken: () => {},
    });

    expect(result.usage).toEqual({ tokensIn: 120, tokensOut: 40 });
  });

  it('un stream cortado a medias da `invalid_json`', async () => {
    const half = STREAM_CONTENT.slice(0, 30);
    const fetchImpl = (async () =>
      sseResponse(slice(half, 6).map(deltaEvent))) as unknown as typeof fetch;

    const tokens: string[] = [];
    const error = (await new LlmClient({ fetchImpl })
      .complete({ ...baseRequest(), onToken: (delta) => tokens.push(delta) })
      .catch((e: unknown) => e)) as LlmCallError;

    expect(error).toBeInstanceOf(LlmCallError);
    expect(error.status).toBe('invalid_json');
    // Los tokens que sí llegaron son un prefijo del `reply` verdadero: por eso
    // el endpoint SSE manda el `TurnResult` completo en el evento `done`.
    expect(STREAM_REPLY.startsWith(tokens.join(''))).toBe(true);
  });

  it('un error dentro del stream se mapea a `provider_error` sin filtrar la key', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        deltaEvent('{"reply":"Hi'),
        `data: ${JSON.stringify({ error: { message: `bad key ${API_KEY}`, code: 500 } })}\n\n`,
      ])) as unknown as typeof fetch;

    const error = (await new LlmClient({ fetchImpl })
      .complete({ ...baseRequest(), onToken: () => {} })
      .catch((e: unknown) => e)) as LlmCallError;

    expect(error.status).toBe('provider_error');
    expect(error.detail ?? '').not.toContain(API_KEY);
    expect(error.detail ?? '').toContain('[REDACTED]');
  });

  it('un `onToken` que lanza no rompe la llamada (cliente colgado)', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        ...slice(STREAM_CONTENT, 11).map(deltaEvent),
        'data: [DONE]\n\n',
      ])) as unknown as typeof fetch;

    let calls = 0;
    const result = await new LlmClient({ fetchImpl }).complete({
      ...baseRequest(),
      onToken: () => {
        calls++;
        throw new Error('ERR_STREAM_WRITE_AFTER_END');
      },
    });

    expect(calls).toBe(1);
    expect(result.data.reply).toBe(STREAM_REPLY);
  });

  it('un 429 con `stream: true` sigue dando `rate_limited` antes de leer el cuerpo', async () => {
    const fetchImpl = (async () =>
      new Response('slow down', { status: 429 })) as unknown as typeof fetch;

    const error = (await new LlmClient({ fetchImpl })
      .complete({ ...baseRequest(), onToken: () => {} })
      .catch((e: unknown) => e)) as LlmCallError;

    expect(error.status).toBe('rate_limited');
  });

  it('el texto acumulado se valida igual que sin streaming: un `reply` vacío es `invalid_json`', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        deltaEvent(JSON.stringify({ reply: '', corrections: [] })),
        'data: [DONE]\n\n',
      ])) as unknown as typeof fetch;

    const error = (await new LlmClient({ fetchImpl })
      .complete({ ...baseRequest(), onToken: () => {} })
      .catch((e: unknown) => e)) as LlmCallError;

    expect(error.status).toBe('invalid_json');
  });

  it('tolera prosa antes del JSON en el stream (el parser reengancha)', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        deltaEvent('Sure! Here you go:\n'),
        ...slice(STREAM_CONTENT, 13).map(deltaEvent),
        'data: [DONE]\n\n',
      ])) as unknown as typeof fetch;

    const tokens: string[] = [];
    const result = await new LlmClient({ fetchImpl }).complete({
      ...baseRequest(),
      onToken: (delta) => tokens.push(delta),
    });

    expect(tokens.join('')).toBe(STREAM_REPLY);
    expect(result.data.reply).toBe(STREAM_REPLY);
  });
});
