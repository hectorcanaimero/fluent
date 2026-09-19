import type { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import { ROLEPLAYS } from '../content/index.js';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { Fact, NewsItem, Profile, Session } from '../db/schema.js';
import { DEGRADED_REPLY, HISTORY_TURNS } from '../llm/config.js';
import type { LlmMessage } from '../llm/llm.client.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { TURN_MAX_ATTEMPTS } from '../llm/config.js';
import { turnsDayKey, userDay } from './user-day.js';
import { turnLockKey, turnPaceKey } from './sessions.constants.js';
import type { SessionsRepository } from './sessions.repository.js';
import {
  TurnsRepository,
  type InsertCorrectionRow,
  type InsertTurnRow,
  type TurnHistoryRow,
} from './turns.repository.js';
import { TurnsService } from './turns.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ROLEPLAY = ROLEPLAYS[0]!;

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: USER_ID,
    group_id: null,
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: ['tech'],
    timezone: 'Europe/Madrid',
    locale: 'es',
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    courtesy_session_used_at: null,
    sessions_count: 0,
    avatar_url: null,
    onboarded_at: '2026-09-01T10:00:00.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function sessionFixture(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    kind: 'free_topic',
    topic: 'Viajes',
    news_item_id: null,
    challenge_from_user_id: null,
    status: 'active',
    started_at: '2026-09-08T10:00:00.000Z',
    ended_at: null,
    duration_sec: null,
    turns_count: 1,
    xp_earned: 0,
    chat_model_used: 'gemini-2.5-flash',
    callback_fact_id: null,
    brief_job_status: 'pending',
    courtesy: false,
    ...overrides,
  };
}

/** `n` turnos alternando tutor (idx par) y usuario (idx impar), desde `idx = 0`. */
function historyFixture(count: number): TurnHistoryRow[] {
  return Array.from({ length: count }, (_unused, idx) => ({
    idx,
    role: idx % 2 === 0 ? ('tutor' as const) : ('user' as const),
    text: `turno ${idx}`,
  }));
}

// ---------------------------------------------------------------------------
// Dobles
// ---------------------------------------------------------------------------

interface FakeSessionsRepoOptions {
  readonly profile?: Profile | null;
  readonly newsItem?: NewsItem | null;
  readonly brief?: string | null;
  readonly facts?: Fact[];
  readonly preference?: { provider: 'openrouter' | 'gemini'; model: string } | null;
  /** Owner del grupo, para los turnos de cortesía (MAL-24). */
  readonly groupOwnerId?: string | null;
}

type FakeSessionsRepo = SessionsRepository & { readonly callCounts: Map<string, number> };

function fakeSessionsRepository(options: FakeSessionsRepoOptions = {}): FakeSessionsRepo {
  const callCounts = new Map<string, number>();
  const count = (name: string): void => {
    callCounts.set(name, (callCounts.get(name) ?? 0) + 1);
  };

  return {
    callCounts,
    findProfile: async () => {
      count('findProfile');
      return options.profile === undefined ? profileFixture() : options.profile;
    },
    findNewsItem: async () => {
      count('findNewsItem');
      return options.newsItem ?? null;
    },
    findBriefText: async () => {
      count('findBriefText');
      return options.brief ?? null;
    },
    listConfirmedFacts: async () => {
      count('listConfirmedFacts');
      return options.facts ?? [];
    },
    findChatModelPreference: async () => {
      count('findChatModelPreference');
      return options.preference ?? null;
    },
    findGroupOwnerId: async () => {
      count('findGroupOwnerId');
      return options.groupOwnerId ?? null;
    },
  } as unknown as FakeSessionsRepo;
}

interface FakeTurnsRepoOptions {
  readonly session?: Session | null;
  readonly history?: TurnHistoryRow[];
  readonly insertTurnError?: Error;
}

type FakeTurnsRepo = TurnsRepository & {
  readonly inserted: InsertTurnRow[];
  readonly corrections: InsertCorrectionRow[][];
  readonly updates: Array<{ turnsCount: number; chatModelUsed?: string | null }>;
  readonly deleted: Array<{ sessionId: string; idx: number }>;
  readonly historyLimits: number[];
};

function fakeTurnsRepository(options: FakeTurnsRepoOptions = {}): FakeTurnsRepo {
  const inserted: InsertTurnRow[] = [];
  const corrections: InsertCorrectionRow[][] = [];
  const updates: Array<{ turnsCount: number; chatModelUsed?: string | null }> = [];
  const deleted: Array<{ sessionId: string; idx: number }> = [];
  const historyLimits: number[] = [];

  return {
    inserted,
    corrections,
    updates,
    deleted,
    historyLimits,
    findOwnedSession: async (userId: string) =>
      options.session === undefined
        ? userId === USER_ID
          ? sessionFixture()
          : null
        : options.session,
    listRecentTurns: async (_sessionId: string, limit: number) => {
      historyLimits.push(limit);
      const rows = options.history ?? historyFixture(1);
      return rows.slice(Math.max(0, rows.length - limit));
    },
    insertTurn: async (row: InsertTurnRow) => {
      inserted.push(row);
    },
    // MEJ-25: el turno del tutor, sus correcciones y los contadores llegan
    // ahora en una sola llamada. Se descompone en los mismos registros que
    // antes para que el resto de aserciones sigan valiendo.
    recordTurn: async (args: {
      sessionId: string;
      tutorIdx: number;
      text: string;
      model?: string | null;
      tokensIn?: number | null;
      tokensOut?: number | null;
      latencyMs?: number | null;
      turnsCount: number;
      corrections: readonly InsertCorrectionRow[];
    }) => {
      inserted.push({
        sessionId: args.sessionId,
        idx: args.tutorIdx,
        role: 'tutor',
        text: args.text,
        model: args.model,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
        latencyMs: args.latencyMs,
      } as InsertTurnRow);
      corrections.push([...args.corrections]);
      updates.push({ turnsCount: args.turnsCount, chatModelUsed: args.model });
    },
    deleteTurn: async (sessionId: string, idx: number) => {
      deleted.push({ sessionId, idx });
    },
    insertCorrections: async (rows: readonly InsertCorrectionRow[]) => {
      corrections.push([...rows]);
    },
    updateAfterTurn: async (
      _userId: string,
      _sessionId: string,
      patch: { turnsCount: number; chatModelUsed?: string | null },
    ) => {
      updates.push(patch);
    },
  } as unknown as FakeTurnsRepo;
}

function fakeCredentials(
  providers: readonly ('openrouter' | 'gemini')[] = ['openrouter'],
  byUser: Record<string, readonly ('openrouter' | 'gemini')[]> = {},
) {
  return {
    listActive: async (userId: string) =>
      (byUser[userId] ?? providers).map((provider) => ({ provider, apiKey: 'k' })),
  } as unknown as CredentialsService;
}

interface FakeLlmOptions {
  readonly reply?: string;
  readonly corrections?: Array<{
    original: string;
    corrected: string;
    category: string;
    note: string;
  }>;
  readonly unavailable?: boolean;
  readonly error?: Error;
}

interface FakeLlmCall {
  readonly messages: readonly LlmMessage[];
  /** `onToken` que recibió el servicio: solo lo manda el endpoint SSE (T4). */
  readonly onToken?: (delta: string) => void;
  /** `onReset` que recibió el servicio (MAL-22). */
  readonly onReset?: () => void;
  /** Intentos pedidos; el turno usa `TURN_MAX_ATTEMPTS` (MAL-23). */
  readonly maxAttempts?: number;
}

type FakeLlm = LlmService & { readonly calls: FakeLlmCall[] };

function fakeLlm(options: FakeLlmOptions = {}): FakeLlm {
  const calls: FakeLlmCall[] = [];
  return {
    calls,
    complete: async (request: {
      messages: readonly LlmMessage[];
      onToken?: (delta: string) => void;
      onReset?: () => void;
      maxAttempts?: number;
    }) => {
      calls.push({
        messages: request.messages,
        onToken: request.onToken,
        onReset: request.onReset,
        maxAttempts: request.maxAttempts,
      });
      if (options.error) throw options.error;
      if (options.unavailable) throw new LlmUnavailableError([]);
      // Con `onToken` (endpoint SSE) el proveedor va emitiendo el `reply`.
      const reply = options.reply ?? 'Nice! Where did you go?';
      if (request.onToken) {
        request.onToken(reply.slice(0, 5));
        request.onToken(reply.slice(5));
      }
      return {
        data: {
          reply: options.reply ?? 'Nice! Where did you go?',
          corrections: options.corrections ?? [],
        },
        modelUsed: 'gemini-2.5-flash',
        provider: 'gemini' as const,
        usage: { tokensIn: 300, tokensOut: 70 },
        degraded: false,
        attempts: [
          {
            attempt: 1,
            provider: 'gemini' as const,
            model: 'gemini-2.5-flash',
            source: 'fallback' as const,
            status: 'ok' as const,
            latencyMs: 987.4,
          },
        ],
      };
    },
  } as unknown as FakeLlm;
}

/** Redis en memoria con TTL ignorado: basta con "existe o no existe". */
type FakeRedis = RedisService & {
  readonly keys: Set<string>;
  readonly setIfAbsentCalls: string[];
  readonly deleted: string[];
  readonly counters: Map<string, number>;
};

function fakeRedis(
  preset: readonly string[] = [],
  options: { counters?: Map<string, number>; incrementFails?: boolean } = {},
): FakeRedis {
  const keys = new Set<string>(preset);
  const setIfAbsentCalls: string[] = [];
  const deleted: string[] = [];
  const counters = options.counters ?? new Map<string, number>();

  return {
    keys,
    setIfAbsentCalls,
    deleted,
    counters,
    increment: async (key: string) => {
      // `null` simula Redis caído: el tope diario es fail-open (MAL-23).
      if (options.incrementFails) return null;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    setIfAbsent: async (key: string) => {
      setIfAbsentCalls.push(key);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    set: async (key: string) => {
      keys.add(key);
    },
    del: async (key: string) => {
      deleted.push(key);
      return keys.delete(key);
    },
    get: async (key: string) => (keys.has(key) ? '1' : null),
  } as unknown as FakeRedis;
}

/**
 * `PROMPT_VERSION` es 3 (como antes) y el tope diario queda desactivado por
 * defecto, para que los tests que no van de MAL-23 no lo toquen.
 */
function fakeConfig(turnsDailyCap = 0): ConfigService<never, true> {
  return {
    get: (key: string) => (key === 'TURNS_DAILY_CAP' ? turnsDailyCap : 3),
  } as unknown as ConfigService<never, true>;
}



interface BuildOptions extends FakeSessionsRepoOptions, FakeTurnsRepoOptions, FakeLlmOptions {
  readonly llm?: FakeLlm;
  readonly redis?: FakeRedis;
  readonly credentialProviders?: readonly ('openrouter' | 'gemini')[];
  readonly credentialsByUser?: Record<string, readonly ('openrouter' | 'gemini')[]>;
  /** Tope diario de turnos (MAL-23). 0 lo desactiva. */
  readonly turnsDailyCap?: number;
}

function buildService(options: BuildOptions = {}) {
  const sessions = fakeSessionsRepository(options);
  const turns = fakeTurnsRepository(options);
  const llm = options.llm ?? fakeLlm(options);
  const redis = options.redis ?? fakeRedis();
  const service = new TurnsService(
    sessions,
    turns,
    fakeCredentials(options.credentialProviders, options.credentialsByUser),
    llm,
    redis,
    fakeConfig(options.turnsDailyCap ?? 0) as never,
  );
  return { service, sessions, turns, llm, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TurnsService.addTurn · validación (SPEC-04 §4 paso 1)', () => {
  it('sesión de otro usuario → 403 FORBIDDEN (filtro doble id + user_id)', async () => {
    const { service } = buildService({ session: null });

    const error = await service
      .addTurn(OTHER_USER_ID, SESSION_ID, { text: 'Hi' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('FORBIDDEN');
    expect((error as ApiException).getApiBody().statusCode).toBe(403);
  });

  it('sesión inexistente → 403 FORBIDDEN (no se filtra qué sesiones existen)', async () => {
    const { service } = buildService({ session: null });

    await expect(service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('`:id` que no es un UUID → 403 FORBIDDEN, no un 500 de Postgres', async () => {
    const { service, turns } = buildService();

    await expect(service.addTurn(USER_ID, 'no-es-uuid', { text: 'Hi' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(turns.inserted).toHaveLength(0);
  });

  it('sesión ya cerrada → 409 SESSION_NOT_ACTIVE', async () => {
    const { service } = buildService({ session: sessionFixture({ status: 'ended' }) });

    const error = await service
      .addTurn(USER_ID, SESSION_ID, { text: 'Hi' })
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('SESSION_NOT_ACTIVE');
    expect((error as ApiException).getApiBody().statusCode).toBe(409);
  });

  it('texto en blanco → 400 VALIDATION con `details[]`', async () => {
    const { service } = buildService();

    const error = await service
      .addTurn(USER_ID, SESSION_ID, { text: '    ' })
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('VALIDATION');
    expect((error as ApiException).getApiBody()).toMatchObject({
      details: [{ field: 'text' }],
    });
  });

  it('sin credencial activa → 409 PROVIDER_NOT_CONNECTED', async () => {
    const { service } = buildService({ credentialProviders: [] });

    await expect(service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' })).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONNECTED',
    });
  });
});

describe('TurnsService.addTurn · lock y ritmo (SPEC-04 §4, SPEC-02 §7)', () => {
  it('lock ya tomado → 409 SESSION_NOT_ACTIVE con el mensaje de "espera la respuesta anterior"', async () => {
    const redis = fakeRedis([turnLockKey(SESSION_ID)]);
    const { service, turns } = buildService({ redis });

    const error = await service
      .addTurn(USER_ID, SESSION_ID, { text: 'Hi' })
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('SESSION_NOT_ACTIVE');
    expect((error as ApiException).getApiBody().message).toContain('Espera la respuesta anterior');
    // No se llegó a escribir nada: el turno perdedor no toca la base.
    expect(turns.inserted).toHaveLength(0);
  });

  it('el lock se libera siempre, también cuando el turno falla', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ redis, error: new Error('boom') });

    await expect(service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' })).rejects.toThrow('boom');
    expect(redis.deleted).toEqual([turnLockKey(SESSION_ID)]);
    expect(redis.keys.has(turnLockKey(SESSION_ID))).toBe(false);
  });

  it('el lock se toma antes que la ventana de ritmo, para que la concurrencia dé 409 y no 429', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ redis });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(redis.setIfAbsentCalls).toEqual([turnLockKey(SESSION_ID), turnPaceKey(SESSION_ID)]);
  });

  it('segundo turno dentro de la ventana de 2 s → 429 RATE_LIMITED', async () => {
    const redis = fakeRedis([turnPaceKey(SESSION_ID)]);
    const { service, turns } = buildService({ redis });

    const error = await service
      .addTurn(USER_ID, SESSION_ID, { text: 'Hi' })
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('RATE_LIMITED');
    expect((error as ApiException).getApiBody().statusCode).toBe(429);
    expect(turns.inserted).toHaveLength(0);
    // Aunque el ritmo rechace, el lock queda liberado.
    expect(redis.deleted).toEqual([turnLockKey(SESSION_ID)]);
  });

  it('dos turnos seguidos sobre la misma sesión: el segundo choca con la ventana de ritmo', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ redis });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Primero' });

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'Segundo' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('TurnsService.addTurn · historial y prompt (SPEC-04 §4 paso 3, SPEC-03 §3)', () => {
  it('el historial que se manda al modelo nunca supera HISTORY_TURNS turnos', async () => {
    const { service, llm, turns } = buildService({ history: historyFixture(40) });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'And then?' });

    expect(turns.historyLimits).toEqual([HISTORY_TURNS]);

    const messages = llm.calls[0]!.messages;
    // 1 system + como mucho 8 de historial + 1 del mensaje del aprendiz.
    expect(messages).toHaveLength(HISTORY_TURNS + 2);
    expect(messages[0]!.role).toBe('system');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'And then?' });
  });

  it('el turno recién insertado del usuario no se duplica dentro de `history`', async () => {
    const { service, llm } = buildService({ history: historyFixture(3) });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Sí, fui a Roma' });

    const contents = llm.calls[0]!.messages.map((message) => message.content);
    expect(contents.filter((content) => content === 'Sí, fui a Roma')).toHaveLength(1);
  });

  it('el historial va en orden cronológico y con el rol traducido a la API del proveedor', async () => {
    const { service, llm } = buildService({ history: historyFixture(3) });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Vale' });

    expect(llm.calls[0]!.messages.slice(1, 4)).toEqual([
      { role: 'assistant', content: 'turno 0' },
      { role: 'user', content: 'turno 1' },
      { role: 'assistant', content: 'turno 2' },
    ]);
  });

  it('reconstruye el escenario del roleplay desde `sessions.topic`, sin `opening_rule`', async () => {
    const { service, llm } = buildService({
      session: sessionFixture({ kind: 'roleplay', topic: ROLEPLAY.title_es }),
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'A table for two, please' });

    const system = llm.calls[0]!.messages[0]!.content;
    expect(system).toContain(`You play ${ROLEPLAY.role}`);
    expect(system).toContain(ROLEPLAY.situation);
    expect(system).not.toContain('6. Open');
  });

  it('news con la noticia purgada sigue el turno con el bloque free_topic', async () => {
    const { service, llm } = buildService({
      session: sessionFixture({
        kind: 'news',
        topic: 'Solar power beats coal in Europe',
        news_item_id: '44444444-4444-4444-8444-444444444444',
      }),
      newsItem: null,
    });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'I agree' });

    expect(result.degraded).toBe(false);
    expect(llm.calls[0]!.messages[0]!.content).toContain(
      'Session type: free_topic. Topic: Solar power beats coal in Europe.',
    );
  });
});

describe('TurnsService.addTurn · persistencia (SPEC-04 §4 pasos 2, 5 y 6)', () => {
  it('inserta el turno del usuario con `último idx + 1` y el del tutor con el siguiente', async () => {
    const { service, turns } = buildService({ history: historyFixture(5) }); // idx 0..4

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hola' });

    expect(result.turnIdx).toBe(5);
    expect(turns.inserted).toEqual([
      { sessionId: SESSION_ID, idx: 5, role: 'user', text: 'Hola' },
      {
        sessionId: SESSION_ID,
        idx: 6,
        role: 'tutor',
        text: 'Nice! Where did you go?',
        model: 'gemini-2.5-flash',
        tokensIn: 300,
        tokensOut: 70,
        latencyMs: 987, // redondeada (PEND-19)
      },
    ]);
  });

  it('las correcciones se guardan con el `turn_idx` del turno del USUARIO', async () => {
    const { service, turns } = buildService({
      history: historyFixture(3), // idx 0..2 ⇒ el turno del usuario es el 3
      corrections: [
        {
          original: 'I go to Rome',
          corrected: 'I went to Rome',
          category: 'past_simple',
          note: 'Usa pasado simple.',
        },
      ],
    });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'I go to Rome' });

    expect(result.turnIdx).toBe(3);
    expect(turns.corrections).toEqual([
      [
        {
          sessionId: SESSION_ID,
          userId: USER_ID,
          turnIdx: 3,
          original: 'I go to Rome',
          corrected: 'I went to Rome',
          category: 'past_simple',
          note: 'Usa pasado simple.',
        },
      ],
    ]);
    expect(result.corrections).toEqual([
      {
        original: 'I go to Rome',
        corrected: 'I went to Rome',
        category: 'past_simple',
        note: 'Usa pasado simple.',
      },
    ]);
  });

  it('recorta `note` a 140 caracteres antes del INSERT (CHECK de la migración 3)', async () => {
    const { service, turns } = buildService({
      corrections: [
        {
          original: 'a',
          corrected: 'b',
          category: 'other',
          note: 'x'.repeat(300),
        },
      ],
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'a' });

    expect(turns.corrections[0]![0]!.note).toHaveLength(140);
  });

  it('`note` vacía llega a la app como cadena vacía, nunca `null`', async () => {
    const { service } = buildService({
      corrections: [{ original: 'a', corrected: 'b', category: 'other', note: '' }],
    });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'a' });

    expect(result.corrections[0]!.note).toBe('');
  });

  it('sin correcciones no se escribe nada en `corrections`', async () => {
    const { service, turns } = buildService({ corrections: [] });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(result.corrections).toEqual([]);
    expect(turns.corrections).toEqual([[]]);
  });

  it('actualiza `turns_count` (+1, turnos del usuario) y `chat_model_used`', async () => {
    const { service, turns } = buildService({
      session: sessionFixture({ turns_count: 4, chat_model_used: 'viejo/modelo' }),
    });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(turns.updates).toEqual([{ turnsCount: 5, chatModelUsed: 'gemini-2.5-flash' }]);
    expect(result.modelUsed).toBe('gemini-2.5-flash');
  });

  it('un fallo inesperado del modelo deshace el turno del usuario y se propaga', async () => {
    const { service, turns } = buildService({
      history: historyFixture(2),
      error: new Error('kaboom'),
    });

    await expect(service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' })).rejects.toThrow('kaboom');

    expect(turns.inserted).toHaveLength(1);
    expect(turns.deleted).toEqual([{ sessionId: SESSION_ID, idx: 2 }]);
    expect(turns.updates).toHaveLength(0);
  });
});

describe('TurnsService.addTurn · degradación (SPEC-03 §6, RF-2.5)', () => {
  it('cadena agotada → 200 con `DEGRADED_REPLY`, `degraded` y `unavailable`', async () => {
    const { service } = buildService({ history: historyFixture(3), unavailable: true });

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(result).toEqual({
      turnIdx: 3,
      reply: DEGRADED_REPLY,
      corrections: [],
      modelUsed: null,
      degraded: true,
      unavailable: true,
    });
  });

  it('el turno degradado del tutor se persiste con modelo, tokens y latencia nulos', async () => {
    const { service, turns } = buildService({ history: historyFixture(3), unavailable: true });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(turns.inserted[1]).toEqual({
      sessionId: SESSION_ID,
      idx: 4,
      role: 'tutor',
      text: DEGRADED_REPLY,
      model: null,
      tokensIn: null,
      tokensOut: null,
      latencyMs: null,
    });
  });

  it('`turns_count` avanza igualmente y `chat_model_used` se conserva', async () => {
    const { service, turns } = buildService({
      session: sessionFixture({ turns_count: 2, chat_model_used: 'gemini-2.5-flash' }),
      unavailable: true,
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(turns.updates).toEqual([{ turnsCount: 3, chatModelUsed: null }]);
    expect(turns.deleted).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Streaming (SPEC-04 §4, RF-3.8) — PR-04/T4
// ---------------------------------------------------------------------------

describe('TurnsService.addTurn · `onToken` (endpoint SSE)', () => {
  const CORRECTIONS = [
    {
      original: 'I go to gym yesterday',
      corrected: 'I went to the gym yesterday',
      category: 'past_simple',
      note: 'Usa el pasado simple.',
    },
  ];

  it('sin `onToken` la llamada al modelo no pide streaming', async () => {
    const { service, llm } = buildService();

    await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });

    expect(llm.calls[0]?.onToken).toBeUndefined();
  });

  it('con `onToken` se pasa tal cual a `LlmService` y llegan los deltas', async () => {
    const { service, llm } = buildService({ reply: 'Nice! Where did you go?' });
    const tokens: string[] = [];

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' }, (delta) =>
      tokens.push(delta),
    );

    expect(llm.calls[0]?.onToken).toBeInstanceOf(Function);
    expect(tokens.join('')).toBe('Nice! Where did you go?');
    expect(result.reply).toBe('Nice! Where did you go?');
  });

  it('persiste exactamente lo mismo que el endpoint no streaming', async () => {
    const plain = buildService({ corrections: CORRECTIONS });
    const streamed = buildService({ corrections: CORRECTIONS });

    const plainResult = await plain.service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' });
    const streamedResult = await streamed.service.addTurn(
      USER_ID,
      SESSION_ID,
      { text: 'Hi' },
      () => {},
    );

    expect(streamedResult).toEqual(plainResult);
    expect(streamed.turns.inserted).toEqual(plain.turns.inserted);
    expect(streamed.turns.corrections).toEqual(plain.turns.corrections);
    expect(streamed.turns.updates).toEqual(plain.turns.updates);
  });

  it('la degradación de SPEC-03 §6 no emite ningún token (el endpoint manda el `reply` fijo entero)', async () => {
    const { service } = buildService({ unavailable: true });
    const tokens: string[] = [];

    const result = await service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' }, (delta) =>
      tokens.push(delta),
    );

    expect(tokens).toHaveLength(0);
    expect(result).toMatchObject({ reply: DEGRADED_REPLY, degraded: true, unavailable: true });
  });

  it('el lock y el ritmo se aplican igual en streaming', async () => {
    const redis = fakeRedis([turnLockKey(SESSION_ID)]);
    const { service } = buildService({ redis });

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'Hi' }, () => {}),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_ACTIVE' });
  });

  it('un texto en blanco falla antes de emitir nada, también en streaming', async () => {
    const { service, llm } = buildService();
    const tokens: string[] = [];

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: '   ' }, (delta) => tokens.push(delta)),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(tokens).toHaveLength(0);
    expect(llm.calls).toHaveLength(0);
  });
});

describe('TurnsService.addTurn · tope diario de turnos (MAL-23)', () => {
  /**
   * La ventana de ritmo de 2 s por sesión (SPEC-02 §7) rechazaría el segundo
   * turno de cualquiera de estos tests antes de llegar al tope diario, que es
   * lo que se quiere probar aquí. En producción esos 2 s pasan solos.
   */
  function skipPaceWindow(redis: FakeRedis): void {
    redis.keys.delete(turnPaceKey(SESSION_ID));
  }

  it('deja pasar mientras no se llegue al tope', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ redis, turnsDailyCap: 3 });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });

    const key = [...redis.counters.keys()][0]!;
    expect(key).toMatch(/^turns:day:/);
    expect(redis.counters.get(key)).toBe(1);
  });

  it('al pasarse responde 429 TURNS_DAILY_CAP con retryAfter', async () => {
    const redis = fakeRedis();
    const { service, llm } = buildService({ redis, turnsDailyCap: 1 });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });
    skipPaceWindow(redis);

    const error = await service
      .addTurn(USER_ID, SESSION_ID, { text: 'dos' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('TURNS_DAILY_CAP');
    expect((error as ApiException).getStatus()).toBe(429);
    const body = (error as ApiException).getApiBody();
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter as number).toBeGreaterThan(0);
    // Solo se llamó al modelo una vez: el turno rechazado no gasta la key.
    expect(llm.calls).toHaveLength(1);
  });

  it('no inserta el turno del usuario cuando rechaza', async () => {
    const redis = fakeRedis();
    const { service, turns } = buildService({ redis, turnsDailyCap: 1 });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });
    skipPaceWindow(redis);
    const insertedBefore = turns.inserted.length;

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'dos' }),
    ).rejects.toMatchObject({ code: 'TURNS_DAILY_CAP' });

    expect(turns.inserted).toHaveLength(insertedBefore);
  });

  it('con el tope a 0 no cuenta nada', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ redis, turnsDailyCap: 0 });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });

    expect(redis.counters.size).toBe(0);
  });

  it('con Redis caído deja pasar (fail-open, como el lock de turno)', async () => {
    const redis = fakeRedis([], { incrementFails: true });
    const { service, llm } = buildService({ redis, turnsDailyCap: 1 });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });
    skipPaceWindow(redis);
    await service.addTurn(USER_ID, SESSION_ID, { text: 'dos' });

    // Bloquear a todo el mundo durante una caída de Redis es peor que perder
    // temporalmente el tope.
    expect(llm.calls).toHaveLength(2);
  });

  it('la clave del contador lleva el día de la zona del perfil', async () => {
    const redis = fakeRedis();
    const { service } = buildService({
      redis,
      turnsDailyCap: 5,
      profile: profileFixture({ timezone: 'Asia/Tokyo' }),
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });

    const key = [...redis.counters.keys()][0]!;
    expect(key).toBe(turnsDayKey(USER_ID, userDay('Asia/Tokyo')));
  });

  it('el turno usa dos intentos y no tres (MAL-23)', async () => {
    const { service, llm } = buildService({});

    await service.addTurn(USER_ID, SESSION_ID, { text: 'uno' });

    expect(llm.calls[0]!.maxAttempts).toBe(TURN_MAX_ATTEMPTS);
  });
});

describe('TurnsService.addTurn · cableado del reset (MAL-22)', () => {
  it('pasa el onReset del endpoint SSE hasta LlmService', async () => {
    const { service, llm } = buildService({});
    const onReset = (): void => {};

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' }, () => {}, onReset);

    // Las dos puntas (llm.service y turn-stream) estaban probadas por
    // separado, pero el parámetro se perdía en el camino: este test cubre el
    // cableado entero.
    expect(llm.calls[0]!.onReset).toBe(onReset);
  });

  it('sin streaming no hay onReset', async () => {
    const { service, llm } = buildService({});

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    expect(llm.calls[0]!.onReset).toBeUndefined();
  });
});

describe('TurnsService.addTurn · contexto en paralelo (MEJ-24)', () => {
  it('no cambia el número de lecturas al repositorio', async () => {
    const { service, sessions } = buildService({});

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    // Paralelizar no puede convertirse en pedir las cosas dos veces.
    expect(Object.fromEntries(sessions.callCounts)).toEqual({
      findProfile: 1,
      findBriefText: 1,
      listConfirmedFacts: 1,
      findChatModelPreference: 1,
    });
  });

  it('con una sesión de noticias también lee la noticia una sola vez', async () => {
    const { service, sessions } = buildService({
      session: sessionFixture({ kind: 'news', news_item_id: 'news-1' }),
      newsItem: {
        id: 'news-1',
        title: 'Solar power',
        summary: 'Solar beat coal.',
      } as never,
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    expect(sessions.callCounts.get('findNewsItem')).toBe(1);
  });

  it('el turno del usuario se sigue insertando después de leer el historial', async () => {
    const { service, turns } = buildService({ history: historyFixture(3) });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    // El historial son los turnos 0..2, así que el del usuario es el 3: si se
    // hubiera insertado antes de leerlo, el índice saldría mal y el turno
    // aparecería duplicado dentro de `history`.
    expect(turns.inserted[0]).toMatchObject({ idx: 3, role: 'user', text: 'hola' });
  });

  it('un perfil sin onboarding sigue ganando al resto de validaciones', async () => {
    const redis = fakeRedis();
    const { service } = buildService({ profile: null, redis, turnsDailyCap: 5 });

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'hola' }),
    ).rejects.toMatchObject({ code: 'NOT_ONBOARDED' });

    // Y no consume cupo diario: el orden de validación no cambió.
    expect(redis.counters.size).toBe(0);
  });

  it('sin credenciales sigue dando PROVIDER_NOT_CONNECTED', async () => {
    const { service } = buildService({ credentialProviders: [] });

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'hola' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONNECTED' });
  });
});

describe('TurnsService.addTurn · escritura atómica del turno (MEJ-25)', () => {
  it('escribe turno, correcciones y contadores en una sola llamada', async () => {
    const { service, turns } = buildService({
      corrections: [
        {
          original: 'I go yesterday',
          corrected: 'I went yesterday',
          category: 'past_simple',
          note: 'Usá el pasado simple.',
        },
      ],
    });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'I go yesterday' });

    // El doble descompone `recordTurn` en los tres registros de antes, así
    // que lo que se comprueba aquí es que llegan juntos y coherentes.
    expect(turns.corrections).toHaveLength(1);
    expect(turns.corrections[0]).toHaveLength(1);
    expect(turns.updates[0]).toMatchObject({ chatModelUsed: 'gemini-2.5-flash' });
  });

  it('una respuesta degradada avanza turns_count igualmente', async () => {
    const { service, turns } = buildService({ unavailable: true });

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    // `turns_count` cuenta turnos del usuario (PEND-18): el aprendiz habló.
    expect(turns.updates[0]!.turnsCount).toBe(2);
  });
});

const COURTESY_OWNER_ID = '99999999-9999-4999-8999-999999999999';

describe('TurnsService.addTurn · turnos de una sesión de cortesía (MAL-24)', () => {
  function courtesyOptions(overrides: Record<string, unknown> = {}) {
    return {
      session: sessionFixture({ courtesy: true }),
      profile: profileFixture({ group_id: 'group-1' }),
      credentialsByUser: { [USER_ID]: [], [COURTESY_OWNER_ID]: ['openrouter' as const] },
      groupOwnerId: COURTESY_OWNER_ID,
      ...overrides,
    };
  }

  it('usa la credencial del owner y no falla con PROVIDER_NOT_CONNECTED', async () => {
    const { service, llm } = buildService(courtesyOptions());

    // Sin esto el aprendiz se quedaba con el saludo y nada más, habiendo
    // gastado ya su única sesión gratuita.
    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    expect(llm.calls).toHaveLength(1);
  });

  it('no aplica la preferencia de modelo: la key es prestada', async () => {
    const { service, sessions } = buildService(
      courtesyOptions({ preference: { provider: 'openrouter', model: 'modelo/caro' } }),
    );

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    expect(sessions.callCounts.get('findChatModelPreference')).toBeUndefined();
  });

  it('si el aprendiz conectó su propia key, se usa la suya', async () => {
    const { service, sessions } = buildService(
      courtesyOptions({
        credentialsByUser: { [USER_ID]: ['gemini' as const] },
      }),
    );

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    // Mejor gastar la del dueño de la cuenta que la prestada.
    expect(sessions.callCounts.get('findGroupOwnerId')).toBeUndefined();
  });

  it('una sesión normal no pide el owner del grupo', async () => {
    const { service, sessions } = buildService({});

    await service.addTurn(USER_ID, SESSION_ID, { text: 'hola' });

    expect(sessions.callCounts.get('findGroupOwnerId')).toBeUndefined();
  });

  it('si el owner se quedó sin credencial, el turno da PROVIDER_NOT_CONNECTED', async () => {
    const { service } = buildService(
      courtesyOptions({
        credentialsByUser: { [USER_ID]: [], [COURTESY_OWNER_ID]: [] },
      }),
    );

    await expect(
      service.addTurn(USER_ID, SESSION_ID, { text: 'hola' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONNECTED' });
  });
});
