import { ApiException } from '../common/api-error.js';
import type { CorrectionDto, TurnResultDto } from './sessions.types.js';
import { SSE_HEADERS, runTurnStream, type SseResponse } from './turn-stream.js';

/**
 * `POST /sessions/:id/turns/stream` (SPEC-04 §4, «Streaming (RF-3.8, P1)»).
 *
 * `runTurnStream` es la única parte del endpoint que no comparte con
 * `POST /sessions/:id/turns`, así que se prueba con una respuesta de Express
 * simulada y una función de turno de mentira: el turno en sí ya está cubierto
 * por `turns.service.spec.ts`.
 */

const CORRECTION: CorrectionDto = {
  original: 'I go to gym yesterday',
  corrected: 'I went to the gym yesterday',
  category: 'past_simple',
  note: 'Usa el pasado simple.',
};

function turnResult(overrides: Partial<TurnResultDto> = {}): TurnResultDto {
  return {
    turnIdx: 3,
    reply: 'Nice! What did you do at the gym?',
    corrections: [CORRECTION],
    modelUsed: 'fluent-free',
    degraded: false,
    ...overrides,
  };
}

interface FakeResponse extends SseResponse {
  readonly headers: Record<string, string>;
  readonly chunks: string[];
  flushed: number;
  ended: number;
  /** Cabeceras ya escritas cuando se hizo el primer `write`. */
  headersAtFirstWrite: string[] | null;
}

function fakeResponse(options: { readonly failWrites?: boolean } = {}): FakeResponse {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];

  const res: FakeResponse = {
    headers,
    chunks,
    flushed: 0,
    ended: 0,
    headersAtFirstWrite: null,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    flushHeaders() {
      res.flushed++;
    },
    write(chunk: string) {
      if (options.failWrites) {
        throw new Error('ERR_STREAM_WRITE_AFTER_END');
      }
      if (res.headersAtFirstWrite === null) {
        res.headersAtFirstWrite = Object.keys(headers);
      }
      chunks.push(chunk);
      return true;
    },
    end() {
      res.ended++;
      return true;
    },
  };

  return res;
}

/** Los eventos SSE escritos, en orden. */
function events(res: FakeResponse): Array<{ event: string; data: unknown }> {
  return res.chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const [eventLine = '', dataLine = ''] = block.split('\n');
      return {
        event: eventLine.replace(/^event: /, ''),
        data: JSON.parse(dataLine.replace(/^data: /, '')) as unknown,
      };
    });
}

describe('runTurnStream · camino feliz', () => {
  it('emite `token`* → `corrections` → `done` en ese orden', async () => {
    const res = fakeResponse();
    const result = turnResult();

    await runTurnStream(res, async (onToken) => {
      onToken('Nice! ');
      onToken('What did you do');
      onToken(' at the gym?');
      return result;
    });

    expect(events(res)).toEqual([
      { event: 'token', data: { text: 'Nice! ' } },
      { event: 'token', data: { text: 'What did you do' } },
      { event: 'token', data: { text: ' at the gym?' } },
      { event: 'corrections', data: { corrections: [CORRECTION] } },
      { event: 'done', data: result },
    ]);
    expect(res.ended).toBe(1);
  });

  it('escribe las cabeceras SSE (y las vacía) antes del primer token', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken) => {
      onToken('Hi');
      return turnResult({ reply: 'Hi' });
    });

    expect(res.headers).toEqual({ ...SSE_HEADERS });
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(res.headers['X-Accel-Buffering']).toBe('no');
    expect(res.flushed).toBe(1);
    // Ya estaban puestas cuando se escribió el primer evento.
    expect(res.headersAtFirstWrite).toEqual(Object.keys(SSE_HEADERS));
  });

  it('el `done` lleva el mismo cuerpo que el endpoint no streaming', async () => {
    const res = fakeResponse();
    const result = turnResult();

    await runTurnStream(res, async (onToken) => {
      onToken(result.reply);
      return result;
    });

    const done = events(res).at(-1);
    expect(done?.event).toBe('done');
    expect(done?.data).toEqual(result);
  });

  it('los deltas vacíos no generan eventos', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken) => {
      onToken('');
      onToken('Hola');
      onToken('');
      return turnResult({ reply: 'Hola' });
    });

    expect(events(res).filter((e) => e.event === 'token')).toEqual([
      { event: 'token', data: { text: 'Hola' } },
    ]);
  });

  it('escapa saltos de línea y comillas del texto (un `token` nunca rompe el formato SSE)', async () => {
    const res = fakeResponse();
    const text = 'Line one\nLine "two"\n\nend';

    await runTurnStream(res, async (onToken) => {
      onToken(text);
      return turnResult({ reply: text });
    });

    const token = events(res)[0];
    expect(token).toEqual({ event: 'token', data: { text } });
    // Un solo bloque por evento: el `\n\n` del texto va escapado en el JSON.
    expect(res.chunks.join('').split('\n\n').filter(Boolean)).toHaveLength(3);
  });
});

describe('runTurnStream · sin tokens (parser fallido o degradación)', () => {
  it('manda el `reply` completo como un único `token` si no hubo ninguno', async () => {
    const res = fakeResponse();
    const result = turnResult();

    await runTurnStream(res, async () => result);

    expect(events(res)).toEqual([
      { event: 'token', data: { text: result.reply } },
      { event: 'corrections', data: { corrections: [CORRECTION] } },
      { event: 'done', data: result },
    ]);
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
  });

  it('la respuesta degradada de SPEC-03 §6 sale como token único + `done` con `degraded`/`unavailable`', async () => {
    const res = fakeResponse();
    const degraded = turnResult({
      reply: 'Sorry, I lost my train of thought. Could you say that again?',
      corrections: [],
      modelUsed: null,
      degraded: true,
      unavailable: true,
    });

    await runTurnStream(res, async () => degraded);

    const written = events(res);
    expect(written[0]).toEqual({ event: 'token', data: { text: degraded.reply } });
    expect(written[1]).toEqual({ event: 'corrections', data: { corrections: [] } });
    expect(written[2]?.event).toBe('done');
    expect(written[2]?.data).toMatchObject({ degraded: true, unavailable: true, modelUsed: null });
  });
});

describe('runTurnStream · errores', () => {
  it('un error antes del primer token se propaga (respuesta JSON de SPEC-02 §6)', async () => {
    const res = fakeResponse();
    const error = ApiException.of('SESSION_NOT_ACTIVE', 'Esta sesión ya no está activa.');

    await expect(runTurnStream(res, async () => Promise.reject(error))).rejects.toBe(error);

    // Nada escrito: el filtro global puede responder con su status y su cuerpo.
    expect(res.chunks).toHaveLength(0);
    expect(res.headers).toEqual({});
    expect(res.flushed).toBe(0);
    expect(res.ended).toBe(0);
  });

  it('un error después del primer token sale como evento `error` y cierra el stream', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken) => {
      onToken('Ni');
      throw ApiException.of('RATE_LIMITED', 'Vas demasiado rápido.');
    });

    expect(events(res)).toEqual([
      { event: 'token', data: { text: 'Ni' } },
      {
        event: 'error',
        data: {
          error: 'RATE_LIMITED',
          message: 'Vas demasiado rápido.',
          statusCode: 429,
        },
      },
    ]);
    expect(res.ended).toBe(1);
  });

  it('el evento `error` de una excepción cualquiera es `INTERNAL` y no filtra el mensaje original', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken) => {
      onToken('Ni');
      throw new Error('connect ECONNREFUSED 10.0.0.1:5432 (insforge)');
    });

    const last = events(res).at(-1);
    expect(last?.event).toBe('error');
    expect(last?.data).toEqual({
      error: 'INTERNAL',
      message: 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.',
      statusCode: 500,
    });
    expect(JSON.stringify(last?.data)).not.toContain('ECONNREFUSED');
  });

  it('el `details` de una `VALIDATION` viaja tal cual en el evento `error`', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken) => {
      onToken('Ni');
      throw ApiException.of('VALIDATION', 'Los datos enviados no son válidos.', {
        extra: { details: [{ field: 'text', reason: 'text no puede estar en blanco.' }] },
      });
    });

    expect(events(res).at(-1)?.data).toMatchObject({
      error: 'VALIDATION',
      statusCode: 400,
      details: [{ field: 'text', reason: 'text no puede estar en blanco.' }],
    });
  });

  it('si el cliente cuelga, un fallo de escritura no se propaga', async () => {
    const res = fakeResponse({ failWrites: true });

    await expect(runTurnStream(res, async () => turnResult())).resolves.toBeUndefined();
    expect(res.ended).toBe(1);
  });

  it('un `onToken` que falla al escribir tampoco rompe el turno', async () => {
    const res = fakeResponse({ failWrites: true });
    let thrown = false;

    await runTurnStream(res, async (onToken) => {
      try {
        onToken('Hi');
      } catch {
        // `LlmClient` hace justo esto: deja de emitir y sigue con el turno.
        thrown = true;
      }
      return turnResult();
    });

    expect(thrown).toBe(true);
    expect(res.ended).toBe(1);
  });

  it('emite `event: reset` cuando la cadena cambia de modelo (MAL-22)', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (onToken, onReset) => {
      onToken('Nice! What');
      // El intento falla y la cadena pasa a otro modelo.
      onReset();
      onToken('Great! How');
      return turnResult({ reply: 'Great! How was it?' });
    });

    const body = res.chunks.join('');
    expect(body).toContain('event: reset\ndata: {}\n\n');
    // El reset va después del texto descartado y antes del nuevo.
    expect(body.indexOf('Nice! What')).toBeLessThan(body.indexOf('event: reset'));
    expect(body.indexOf('event: reset')).toBeLessThan(body.indexOf('Great! How'));
  });

  it('no emite `reset` si todavía no se había mandado nada (MAL-22)', async () => {
    const res = fakeResponse();

    await runTurnStream(res, async (_onToken, onReset) => {
      // Falla el primer intento sin llegar a emitir: no hay burbuja que vaciar.
      onReset();
      return turnResult();
    });

    expect(res.chunks.join('')).not.toContain('event: reset');
  });
});
