import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';

import { ROLEPLAYS } from '../src/content/index.js';
import { CredentialsService } from '../src/credentials/credentials.service.js';
import { DEGRADED_REPLY, HISTORY_TURNS } from '../src/llm/config.js';
import type { LlmMessage } from '../src/llm/types.js';
import { LlmService, LlmUnavailableError } from '../src/llm/llm.service.js';
import { REDIS_CACHE_CLIENT } from '../src/redis/redis.constants.js';
import { ConfigService } from '@nestjs/config';
import { TURNS_THROTTLE_LIMIT } from '../src/rate-limit/rate-limit.constants.js';
import { RedisService } from '../src/redis/redis.service.js';
import { turnsDayKey, userDay } from '../src/sessions/user-day.js';
import { SESSION_RANDOM } from '../src/sessions/sessions.constants.js';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  loadInsforgeE2eCredentials,
  registerE2eUser,
  createE2eGroup,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';
import { seedProfile } from './fixtures.js';

/**
 * e2e de PR-04/T2 (`POST /sessions/:id/turns`, SPEC-04 §4) contra la rama real
 * de InsForge, con el LLM **siempre** simulado (`.overrideProvider(LlmService)`).
 *
 * **Por qué un archivo aparte de `sessions.e2e-spec.ts`** (decisión anotada en
 * docs/specs/pendientes/PR-04.md): el de T1 ya pasaba de 370 líneas y su
 * `beforeAll` no simula Redis; aquí hacen falta un doble de Redis con
 * semántica `NX`/`EX` real (para probar de verdad el lock y el ritmo) y un
 * doble de LLM conmutable (para la degradación). Mezclarlo habría obligado a
 * reescribir el arranque de T1.
 *
 * **Por qué un doble de Redis en memoria y no `testcontainers`** (como
 * `admin.e2e-spec.ts`): el lock y la ventana de ritmo solo necesitan
 * `SET … EX … NX` y `DEL`, que el doble reproduce con expiración real, y así
 * la suite no arranca ni deja vivo ningún contenedor (regla 8 del diseño de
 * PR-04). Mismo criterio que `providers.e2e-spec.ts`.
 *
 * Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` / `INSFORGE_ANON_KEY` en
 * `process.env` o en el archivo gitignored `apps/api/.env.test.local`; si no
 * están, se salta entero.
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de turno de conversación (docs/tasks/PR-04-sesion.md, T2).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

const ROLEPLAY = ROLEPLAYS[0]!;
const FAKE_MODEL = 'fake/e2e-model';
const OPENING_TEXT = 'Hi there! What did you do last weekend?';
const TURN_REPLY = 'Nice! And what was the best part of it?';

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Doble de `ioredis` en memoria con expiración real y soporte de `NX`: es lo
 * que hace falta para que el lock de SPEC-04 §4 y la ventana de 2 s de
 * SPEC-02 §7 se comporten como en producción sin levantar un Redis.
 */
function createRedisDouble() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  function alive(key: string): { value: string; expiresAt: number | null } | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  }

  return {
    ping: async () => 'PONG',
    get: async (key: string) => alive(key)?.value ?? null,
    set: async (key: string, value: string, ...args: unknown[]) => {
      const flags = args.map((arg) => String(arg).toUpperCase());
      if (flags.includes('NX') && alive(key) !== null) {
        return null;
      }
      const exIndex = flags.indexOf('EX');
      const ttlSeconds = exIndex >= 0 ? Number(args[exIndex + 1]) : null;
      store.set(key, {
        value,
        expiresAt: ttlSeconds === null ? null : Date.now() + ttlSeconds * 1000,
      });
      return 'OK';
    },
    del: async (key: string) => (store.delete(key) ? 1 : 0),
    // Contador del tope diario de turnos (MAL-23).
    incr: async (key: string) => {
      const current = Number(alive(key)?.value ?? 0);
      const next = current + 1;
      store.set(key, { value: String(next), expiresAt: alive(key)?.expiresAt ?? null });
      return next;
    },
    expire: async (key: string, ttlSeconds: number) => {
      const entry = alive(key);
      if (!entry) return 0;
      store.set(key, { value: entry.value, expiresAt: Date.now() + ttlSeconds * 1000 });
      return 1;
    },
  };
}

interface LlmCallRecord {
  readonly messages: readonly LlmMessage[];
  /** ¿La llamada pidió streaming? Solo lo hace `POST .../turns/stream` (T4). */
  readonly streamed: boolean;
}

/** Eventos SSE de una respuesta de `POST /sessions/:id/turns/stream`. */
function parseSse(text: string): Array<{ event: string; data: Record<string, unknown> }> {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const [eventLine = '', dataLine = ''] = block.split('\n');
      return {
        event: eventLine.replace(/^event: /, ''),
        data: JSON.parse(dataLine.replace(/^data: /, '')) as Record<string, unknown>,
      };
    });
}

maybeDescribe('Turno de conversación (e2e, InsForge)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];
  const seededGroupIds: string[] = [];
  const seededSessionIds: string[] = [];
  /** Grupo compartido: desde MEJ-33 `POST /sessions` lo exige. */
  let sharedGroupId: string;

  /** Llamadas que recibió el doble de `LlmService`, en orden. */
  let llmCalls: LlmCallRecord[] = [];
  /** Cuando es `true`, el doble lanza `LlmUnavailableError` (SPEC-03 §6). */
  let llmUnavailable = false;
  /** Correcciones que devuelve el doble en el siguiente turno. */
  let llmCorrections: Array<{
    original: string;
    corrected: string;
    category: string;
    note: string;
  }> = [];

  /** Doble de `LlmService` que nunca sale a la red (regla 6 del diseño). */
  const fakeLlm = {
    complete: async (req: {
      messages: readonly LlmMessage[];
      onToken?: (delta: string) => void;
    }) => {
      llmCalls.push({ messages: req.messages, streamed: req.onToken !== undefined });
      if (llmUnavailable) {
        throw new LlmUnavailableError([]);
      }
      // La apertura manda el mensaje fijo de SPEC-04 §3.4; los turnos, el
      // texto del aprendiz.
      const isOpening = llmCalls.length === 1;
      const reply = isOpening ? OPENING_TEXT : TURN_REPLY;
      // Con `onToken` (endpoint SSE) el proveedor va soltando el `reply`.
      if (req.onToken) {
        req.onToken(reply.slice(0, 6));
        req.onToken(reply.slice(6));
      }
      return {
        data: {
          reply,
          corrections: isOpening ? [] : llmCorrections,
        },
        modelUsed: FAKE_MODEL,
        provider: 'openrouter' as const,
        usage: { tokensIn: 210, tokensOut: 55 },
        degraded: false,
        attempts: [
          {
            attempt: 1,
            provider: 'openrouter' as const,
            model: FAKE_MODEL,
            source: 'fallback' as const,
            status: 'ok' as const,
            latencyMs: 123.7,
          },
        ],
      };
    },
  };

  async function newReadyUser(namePrefix: string): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    await seedProfile(admin, user.id, {
      displayName: namePrefix,
      level: 'B1',
      groupId: sharedGroupId,
    });
    // La cifra con la clave maestra de `.env.test`; nunca es una key real.
    await app.get(CredentialsService).saveApiKey(user.id, 'openrouter', 'clave-falsa');
    return user;
  }

  async function openSession(
    user: E2eTestUser,
    body: Record<string, unknown> = { kind: 'free_topic', topic: 'Mis vacaciones' },
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/sessions')
      .set(authHeader(user.accessToken))
      .send(body)
      .expect(201);

    const sessionId = response.body.session.id as string;
    seededSessionIds.push(sessionId);
    return sessionId;
  }

  function postTurn(user: E2eTestUser, sessionId: string, text: string) {
    return request(app.getHttpServer())
      .post(`/v1/sessions/${sessionId}/turns`)
      .set(authHeader(user.accessToken))
      .send({ text });
  }

  function postTurnStream(user: E2eTestUser, sessionId: string, text: string) {
    return request(app.getHttpServer())
      .post(`/v1/sessions/${sessionId}/turns/stream`)
      .set(authHeader(user.accessToken))
      .send({ text });
  }

  async function readTurns(sessionId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await admin.database
      .from('turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('idx', { ascending: true });

    if (error) {
      throw new Error(`No se pudieron leer los turnos de ${sessionId}: ${error.message}`);
    }
    return (data ?? []) as Record<string, unknown>[];
  }

  async function readSession(sessionId: string): Promise<Record<string, unknown>> {
    const { data, error } = await admin.database
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      throw new Error(`No se pudo leer la sesión ${sessionId}: ${error?.message}`);
    }
    return data as Record<string, unknown>;
  }

  /** Siembra turnos directamente en base, para no gastar la ventana de ritmo. */
  async function seedTurns(sessionId: string, fromIdx: number, count: number): Promise<void> {
    const rows = Array.from({ length: count }, (_unused, offset) => {
      const idx = fromIdx + offset;
      return {
        session_id: sessionId,
        idx,
        role: idx % 2 === 0 ? 'tutor' : 'user',
        text: `Sembrado ${idx}`,
      };
    });

    const { error } = await admin.database.from('turns').insert(rows);
    if (error) {
      throw new Error(`No se pudieron sembrar los turnos de ${sessionId}: ${error.message}`);
    }
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const group = await createE2eGroup(admin, 'Turns E2E');
    sharedGroupId = group.id;
    seededGroupIds.push(group.id);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue(fakeLlm)
      .overrideProvider(SESSION_RANDOM)
      // 1 ⇒ nunca hay callback: los turnos no dependen de la memoria.
      .useValue(() => 1)
      .overrideProvider(REDIS_CACHE_CLIENT)
      .useValue(createRedisDouble())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    // `turns` y `corrections` caen en cascada con su sesión.
    for (const sessionId of seededSessionIds) {
      await admin.database.from('sessions').delete().eq('id', sessionId);
    }
    for (const userId of seededUserIds) {
      await admin.database.from('corrections').delete().eq('user_id', userId);
      await admin.database.from('sessions').delete().eq('user_id', userId);
      await admin.database.from('provider_credentials').delete().eq('user_id', userId);
    }
    await cleanupE2eData(admin, { userIds: seededUserIds, groupIds: seededGroupIds });
    await app.close();
  }, 60_000);

  beforeEach(() => {
    llmCalls = [];
    llmUnavailable = false;
    llmCorrections = [];
  });

  it('POST /v1/sessions/:id/turns responde 200 y persiste turno del usuario, del tutor y correcciones', async () => {
    const user = await newReadyUser('T ok');
    const sessionId = await openSession(user);

    llmCorrections = [
      {
        original: 'I go to Rome',
        corrected: 'I went to Rome',
        category: 'past_simple',
        note: 'Usa el pasado simple para algo que ya terminó.',
      },
    ];

    const response = await postTurn(user, sessionId, 'I go to Rome last week').expect(200);

    expect(response.body).toMatchObject({
      // El `idx` del turno del USUARIO (la apertura del tutor es el 0).
      turnIdx: 1,
      reply: TURN_REPLY,
      modelUsed: FAKE_MODEL,
      degraded: false,
    });
    expect(response.body.unavailable).toBeUndefined();
    expect(response.body.corrections).toEqual([
      {
        original: 'I go to Rome',
        corrected: 'I went to Rome',
        category: 'past_simple',
        note: 'Usa el pasado simple para algo que ya terminó.',
      },
    ]);

    const turns = await readTurns(sessionId);
    expect(turns).toHaveLength(3);
    expect(turns[1]).toMatchObject({ idx: 1, role: 'user', text: 'I go to Rome last week' });
    expect(turns[2]).toMatchObject({
      idx: 2,
      role: 'tutor',
      text: TURN_REPLY,
      model: FAKE_MODEL,
      tokens_in: 210,
      tokens_out: 55,
      latency_ms: 124,
    });

    const session = await readSession(sessionId);
    // `turns_count` cuenta turnos del USUARIO (PEND-18).
    expect(session.turns_count).toBe(1);
    expect(session.chat_model_used).toBe(FAKE_MODEL);

    const { data: corrections } = await admin.database
      .from('corrections')
      .select('*')
      .eq('session_id', sessionId);
    expect(corrections).toHaveLength(1);
    // `corrections.turn_idx` apunta al turno del usuario, no al del tutor.
    expect((corrections as Array<{ turn_idx: number }>)[0]!.turn_idx).toBe(1);
  }, 60_000);

  it('dos turnos concurrentes sobre la misma sesión: uno responde 409 SESSION_NOT_ACTIVE', async () => {
    const user = await newReadyUser('T lock');
    const sessionId = await openSession(user);

    const [first, second] = await Promise.all([
      postTurn(user, sessionId, 'First message'),
      postTurn(user, sessionId, 'Second message'),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const rejected = first.status === 409 ? first : second;
    expect(rejected.body).toMatchObject({ error: 'SESSION_NOT_ACTIVE', statusCode: 409 });
    expect(rejected.body.message).toContain('Espera la respuesta anterior');

    // Solo se escribió el turno ganador: apertura + usuario + tutor.
    const turns = await readTurns(sessionId);
    expect(turns).toHaveLength(3);
  }, 60_000);

  it('alcanzado el tope diario → 429 TURNS_DAILY_CAP con Retry-After (MAL-23)', async () => {
    const user = await newReadyUser('T cap');
    const sessionId = await openSession(user);

    // Se siembra el contador en el tope real de producción en vez de bajarlo
    // por env: así se prueba el valor que se va a desplegar y no se perturba
    // al resto de la suite, que comparte la misma app.
    const cap = app.get(ConfigService).get('TURNS_DAILY_CAP_FREE', { infer: true }) as number;
    const { data: profile } = await admin.database
      .from('profiles')
      .select('timezone')
      .eq('user_id', user.id)
      .single();
    const timezone = (profile as { timezone: string } | null)?.timezone ?? 'UTC';
    const key = turnsDayKey(user.id, userDay(timezone));
    await app.get(RedisService).set(key, String(cap), 3_600);

    const response = await postTurn(user, sessionId, 'Over the cap').expect(429);

    expect(response.body).toMatchObject({ error: 'TURNS_DAILY_CAP', statusCode: 429 });
    expect(typeof response.body.retryAfter).toBe('number');
    expect(response.headers['retry-after']).toBe(String(response.body.retryAfter));

    // Nada escrito: ni el turno del usuario ni el del tutor.
    const turns = await readTurns(sessionId);
    expect(turns).toHaveLength(1); // solo la apertura

    await app.get(RedisService).del(key);
  }, 60_000);

  it('un segundo turno dentro de la ventana de 2 s → 429 RATE_LIMITED', async () => {
    const user = await newReadyUser('T pace');
    const sessionId = await openSession(user);

    await postTurn(user, sessionId, 'First message').expect(200);
    const tooFast = await postTurn(user, sessionId, 'Second message').expect(429);

    expect(tooFast.body).toMatchObject({ error: 'RATE_LIMITED', statusCode: 429 });

    // Pasada la ventana de 2 s el mismo turno entra sin problema.
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    await postTurn(user, sessionId, 'Second message').expect(200);
  }, 60_000);

  it('el historial que recibe el LLM nunca supera HISTORY_TURNS turnos', async () => {
    const user = await newReadyUser('T history');
    const sessionId = await openSession(user);
    // La apertura dejó el idx 0; se siembran 20 turnos más (idx 1..20).
    await seedTurns(sessionId, 1, 20);

    llmCalls = [];
    await postTurn(user, sessionId, 'And then what happened?').expect(200);

    const messages = llmCalls.at(-1)!.messages;
    // 1 system + como mucho HISTORY_TURNS de historial + el mensaje del aprendiz.
    expect(messages.length).toBeLessThanOrEqual(HISTORY_TURNS + 2);
    expect(messages[0]!.role).toBe('system');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'And then what happened?' });
    // El turno nuevo del usuario toma `último idx + 1`.
    const turns = await readTurns(sessionId);
    expect(turns.at(-2)).toMatchObject({ idx: 21, role: 'user' });
    expect(turns.at(-1)).toMatchObject({ idx: 22, role: 'tutor' });
  }, 60_000);

  it('cadena de modelos agotada → 200 degradado con `unavailable` y turno del tutor sin métricas', async () => {
    const user = await newReadyUser('T degraded');
    const sessionId = await openSession(user, { kind: 'roleplay', roleplayId: ROLEPLAY.id });

    llmUnavailable = true;
    const response = await postTurn(user, sessionId, 'A table for two, please').expect(200);

    expect(response.body).toMatchObject({
      turnIdx: 1,
      reply: DEGRADED_REPLY,
      corrections: [],
      modelUsed: null,
      degraded: true,
      unavailable: true,
    });

    const turns = await readTurns(sessionId);
    expect(turns[2]).toMatchObject({
      idx: 2,
      role: 'tutor',
      text: DEGRADED_REPLY,
      model: null,
      tokens_in: null,
      tokens_out: null,
      latency_ms: null,
    });

    const session = await readSession(sessionId);
    // El aprendiz sí habló: `turns_count` avanza y se conserva el modelo previo.
    expect(session.turns_count).toBe(1);
    expect(session.chat_model_used).toBe(FAKE_MODEL);
  }, 60_000);

  it('una sesión de otro usuario → 403 FORBIDDEN', async () => {
    const owner = await newReadyUser('T owner');
    const intruder = await newReadyUser('T intruder');
    const sessionId = await openSession(owner);

    const response = await postTurn(intruder, sessionId, 'Hola').expect(403);

    expect(response.body).toMatchObject({ error: 'FORBIDDEN', statusCode: 403 });
  }, 60_000);

  it('un cuerpo vacío o de más de 1 000 caracteres → 400 VALIDATION', async () => {
    const user = await newReadyUser('T body');
    const sessionId = await openSession(user);

    const empty = await postTurn(user, sessionId, '').expect(400);
    expect(empty.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });

    const tooLong = await postTurn(user, sessionId, 'a'.repeat(1_001)).expect(400);
    expect(tooLong.body.error).toBe('VALIDATION');
  }, 60_000);

  it(`más de ${TURNS_THROTTLE_LIMIT} peticiones por minuto en la ruta → 429 RATE_LIMITED`, async () => {
    const user = await newReadyUser('T throttle');
    // Se usa una sesión inexistente a propósito: el throttler corre **antes**
    // que el handler, así que estas peticiones consumen cupo devolviendo 403
    // sin tocar Redis ni la ventana de ritmo, que si no enmascararía el 429
    // del throttler con el suyo.
    const missingSessionId = '00000000-0000-4000-8000-000000000000';

    for (let i = 0; i < TURNS_THROTTLE_LIMIT; i += 1) {
      await postTurn(user, missingSessionId, 'Hola').expect(403);
    }

    const throttled = await postTurn(user, missingSessionId, 'Hola').expect(429);
    expect(throttled.body).toMatchObject({ error: 'RATE_LIMITED', statusCode: 429 });
  }, 60_000);

  // -------------------------------------------------------------------------
  // Streaming (SPEC-04 §4, RF-3.8) — PR-04/T4
  // -------------------------------------------------------------------------

  it('POST /v1/sessions/:id/turns/stream emite `token`* → `corrections` → `done` y persiste igual que el endpoint normal', async () => {
    const user = await newReadyUser('T sse ok');
    const sessionId = await openSession(user);

    llmCorrections = [
      {
        original: 'I go to Rome',
        corrected: 'I went to Rome',
        category: 'past_simple',
        note: 'Usa el pasado simple para algo que ya terminó.',
      },
    ];

    const response = await postTurnStream(user, sessionId, 'I go to Rome last week').expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['x-accel-buffering']).toBe('no');
    // La llamada al modelo sí pidió streaming.
    expect(llmCalls.at(-1)!.streamed).toBe(true);

    const events = parseSse(response.text);
    expect(events.map((event) => event.event)).toEqual([
      'token',
      'token',
      'corrections',
      'done',
    ]);
    expect(
      events
        .filter((event) => event.event === 'token')
        .map((event) => event.data.text as string)
        .join(''),
    ).toBe(TURN_REPLY);
    expect(events[2]!.data.corrections).toEqual([
      {
        original: 'I go to Rome',
        corrected: 'I went to Rome',
        category: 'past_simple',
        note: 'Usa el pasado simple para algo que ya terminó.',
      },
    ]);
    // El `done` es el mismo cuerpo que devuelve `POST .../turns`.
    expect(events[3]!.data).toMatchObject({
      turnIdx: 1,
      reply: TURN_REPLY,
      modelUsed: FAKE_MODEL,
      degraded: false,
    });

    const turns = await readTurns(sessionId);
    expect(turns).toHaveLength(3);
    expect(turns[1]).toMatchObject({ idx: 1, role: 'user', text: 'I go to Rome last week' });
    expect(turns[2]).toMatchObject({ idx: 2, role: 'tutor', text: TURN_REPLY, model: FAKE_MODEL });

    const session = await readSession(sessionId);
    expect(session.turns_count).toBe(1);
    expect(session.chat_model_used).toBe(FAKE_MODEL);

    const { data: corrections } = await admin.database
      .from('corrections')
      .select('*')
      .eq('session_id', sessionId);
    expect(corrections).toHaveLength(1);
    expect((corrections as Array<{ turn_idx: number }>)[0]!.turn_idx).toBe(1);
  }, 60_000);

  it('un error antes de emitir sale como JSON de SPEC-02 §6, no como SSE', async () => {
    const owner = await newReadyUser('T sse owner');
    const intruder = await newReadyUser('T sse intruder');
    const sessionId = await openSession(owner);

    const response = await postTurnStream(intruder, sessionId, 'Hola').expect(403);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toMatchObject({ error: 'FORBIDDEN', statusCode: 403 });
  }, 60_000);

  it('cadena agotada en streaming: el `reply` fijo llega como un único `token` y `done` marca `unavailable`', async () => {
    const user = await newReadyUser('T sse degraded');
    const sessionId = await openSession(user);

    llmUnavailable = true;
    const response = await postTurnStream(user, sessionId, 'A table for two, please').expect(200);

    const events = parseSse(response.text);
    expect(events.map((event) => event.event)).toEqual(['token', 'corrections', 'done']);
    expect(events[0]!.data).toEqual({ text: DEGRADED_REPLY });
    expect(events[1]!.data).toEqual({ corrections: [] });
    expect(events[2]!.data).toMatchObject({
      reply: DEGRADED_REPLY,
      corrections: [],
      modelUsed: null,
      degraded: true,
      unavailable: true,
    });

    const turns = await readTurns(sessionId);
    expect(turns[2]).toMatchObject({ idx: 2, role: 'tutor', text: DEGRADED_REPLY, model: null });
  }, 60_000);
});
