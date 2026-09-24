import 'reflect-metadata';

import { ApiException } from '../common/api-error.js';
import type { CreateTurnDto } from './dto/create-turn.dto.js';
import { SessionsController } from './sessions.controller.js';
import type { TurnResultDto } from './sessions.types.js';
import type { TurnsService } from './turns.service.js';

/**
 * Contrato del endpoint de streaming en el controlador (PR-04/T4): que la ruta
 * y el throttler son los que dice SPEC-04 §4 / SPEC-02 §7, y que el handler no
 * hace nada más que enchufar `TurnsService.addTurn` (el mismo del endpoint no
 * streaming) con `runTurnStream`.
 *
 * El formato de los eventos se prueba en `turn-stream.spec.ts` y el turno en
 * `turns.service.spec.ts`: aquí solo se comprueba el cableado.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const RESULT: TurnResultDto = {
  turnIdx: 3,
  reply: 'Nice! Where did you go?',
  corrections: [],
  modelUsed: 'fluent-free',
  degraded: false,
};

interface Recorded {
  readonly userId: string;
  readonly sessionId: string;
  readonly dto: CreateTurnDto;
  readonly hasOnToken: boolean;
}

function buildController(behaviour: {
  readonly tokens?: readonly string[];
  readonly error?: unknown;
}) {
  const calls: Recorded[] = [];
  const turnsService = {
    addTurn: async (
      userId: string,
      sessionId: string,
      dto: CreateTurnDto,
      onToken?: (delta: string) => void,
    ): Promise<TurnResultDto> => {
      calls.push({ userId, sessionId, dto, hasOnToken: onToken !== undefined });
      for (const token of behaviour.tokens ?? []) {
        onToken?.(token);
      }
      if (behaviour.error !== undefined) throw behaviour.error;
      return RESULT;
    },
  } as unknown as TurnsService;

  const controller = new SessionsController(
    {} as never,
    turnsService,
    {} as never,
    {} as never,
    {} as never,
  );

  return { controller, calls };
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  return {
    headers,
    chunks,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    flushHeaders() {},
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      return true;
    },
  };
}

/** Metadatos que `@nestjs/throttler` deja en el método (sin depender de sus claves). */
function throttlerMetadata(method: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Reflect.getMetadataKeys(method) as string[]) {
    if (String(key).toUpperCase().includes('THROTTLER')) {
      out[String(key)] = Reflect.getMetadata(key, method) as unknown;
    }
  }
  return out;
}

describe('SessionsController.addTurnStream', () => {
  it('está registrado en `POST sessions/:id/turns/stream`', () => {
    const method = SessionsController.prototype.addTurnStream;

    expect(Reflect.getMetadata('path', method)).toBe('sessions/:id/turns/stream');
    // `RequestMethod.POST` es 1 en Nest; se compara contra el endpoint hermano
    // para no depender del valor numérico.
    expect(Reflect.getMetadata('method', method)).toBe(
      Reflect.getMetadata('method', SessionsController.prototype.addTurn),
    );
  });

  it('lleva el mismo `@Throttle(TURNS_THROTTLE)` que el endpoint no streaming', () => {
    const streaming = throttlerMetadata(SessionsController.prototype.addTurnStream);

    expect(Object.keys(streaming).length).toBeGreaterThan(0);
    expect(streaming).toEqual(throttlerMetadata(SessionsController.prototype.addTurn));
  });

  it('delega en `TurnsService.addTurn` con el `onToken` del stream', async () => {
    const { controller, calls } = buildController({ tokens: ['Nice! ', 'Where did you go?'] });
    const res = fakeResponse();
    const dto: CreateTurnDto = { text: 'I went to the gym.' } as CreateTurnDto;

    await controller.addTurnStream(USER_ID, SESSION_ID, dto, res as never);

    expect(calls).toEqual([
      { userId: USER_ID, sessionId: SESSION_ID, dto, hasOnToken: true },
    ]);
    const written = res.chunks.join('');
    expect(written).toContain('event: token\ndata: {"text":"Nice! "}');
    expect(written).toContain('event: corrections\n');
    expect(written).toContain('event: done\n');
    expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
  });

  it('propaga el error si todavía no se emitió nada (lo responde el filtro global)', async () => {
    const error = ApiException.forbidden();
    const { controller } = buildController({ error });
    const res = fakeResponse();

    await expect(
      controller.addTurnStream(USER_ID, SESSION_ID, { text: 'Hi' } as CreateTurnDto, res as never),
    ).rejects.toBe(error);
    expect(res.chunks).toHaveLength(0);
    expect(res.headers).toEqual({});
  });

  it('con tokens ya emitidos el error sale como evento `error`, no como excepción', async () => {
    const { controller } = buildController({
      tokens: ['Nice!'],
      error: ApiException.of('LLM_UNAVAILABLE', 'El asistente no está disponible.'),
    });
    const res = fakeResponse();

    await controller.addTurnStream(
      USER_ID,
      SESSION_ID,
      { text: 'Hi' } as CreateTurnDto,
      res as never,
    );

    const written = res.chunks.join('');
    expect(written).toContain('event: token\n');
    expect(written).toContain('event: error\n');
    expect(written).toContain('"statusCode":503');
    expect(written).not.toContain('event: done\n');
  });
});
