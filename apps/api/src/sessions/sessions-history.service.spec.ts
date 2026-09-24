import type { Correction, Session } from '../db/schema.js';
import { encodeSessionsCursor } from './sessions-cursor.js';
import type { SessionsHistoryRepository } from './sessions-history.repository.js';
import { SessionsHistoryService } from './sessions-history.service.js';
import type { TurnHistoryRow } from './turns.repository.js';
import type { TurnsRepository } from './turns.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function sessionFixture(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    kind: 'free_topic',
    topic: 'Viajes',
    news_item_id: null,
    challenge_from_user_id: null,
    status: 'ended',
    started_at: '2026-09-08T10:00:00.000Z',
    ended_at: '2026-09-08T10:10:00.000Z',
    duration_sec: 600,
    turns_count: 4,
    xp_earned: 60,
    chat_model_used: 'fluent-free',
    callback_fact_id: null,
    brief_job_status: 'done',
    courtesy: false,
    ...overrides,
  };
}

function sessionsList(count: number, startIso = '2026-09-08T10:00:00.000Z'): Session[] {
  const start = new Date(startIso).getTime();
  return Array.from({ length: count }, (_unused, i) =>
    sessionFixture({
      id: `session-${i}`,
      started_at: new Date(start - i * 60_000).toISOString(),
    }),
  );
}

function fakeHistoryRepository(options: {
  rows?: Session[];
  turns?: TurnHistoryRow[];
  corrections?: Correction[];
}) {
  const calls = { listByUser: [] as Array<{ limit: number; cursor: string | null }> };
  const repo = {
    listByUser: async (_userId: string, limit: number, cursor: string | null) => {
      calls.listByUser.push({ limit, cursor });
      return options.rows ?? [];
    },
    listTurns: async () => options.turns ?? [],
    listCorrections: async () => options.corrections ?? [],
  };
  return { repo: repo as unknown as SessionsHistoryRepository, calls };
}

function fakeTurnsRepository(session: Session | null): TurnsRepository {
  return { findOwnedSession: async () => session } as unknown as TurnsRepository;
}

describe('SessionsHistoryService.list', () => {
  it('sin cursor, pide `limit + 1` filas y no hay `nextCursor` si caben todas', async () => {
    const { repo, calls } = fakeHistoryRepository({ rows: sessionsList(3) });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));

    const result = await service.list(USER_ID, {});

    expect(calls.listByUser[0]).toEqual({ limit: 20, cursor: null }); // límite por defecto
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it('con más filas que `limit`, recorta a `limit` y da `nextCursor`', async () => {
    const rows = sessionsList(3); // limit=2 → 3 filas simula "hay más"
    const { repo } = fakeHistoryRepository({ rows });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));

    const result = await service.list(USER_ID, { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('respeta `limit` explícito', async () => {
    const { repo, calls } = fakeHistoryRepository({ rows: sessionsList(1) });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));

    await service.list(USER_ID, { limit: 5 });
    expect(calls.listByUser[0]?.limit).toBe(5);
  });

  it('decodifica un `cursor` válido y lo pasa al repositorio', async () => {
    const { repo, calls } = fakeHistoryRepository({ rows: [] });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));
    const cursor = encodeSessionsCursor({ started_at: '2026-09-08T10:00:00.000Z' });

    await service.list(USER_ID, { cursor });
    expect(calls.listByUser[0]?.cursor).toBe('2026-09-08T10:00:00.000Z');
  });

  it('un `cursor` corrupto → 400 VALIDATION, no 500', async () => {
    const { repo } = fakeHistoryRepository({ rows: [] });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));

    await expect(service.list(USER_ID, { cursor: 'esto-no-es-un-cursor' })).rejects.toMatchObject(
      { code: 'VALIDATION' },
    );
  });
});

describe('SessionsHistoryService.detail', () => {
  it('sesión de otro usuario o inexistente → 403 FORBIDDEN', async () => {
    const { repo } = fakeHistoryRepository({});
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(null));

    await expect(service.detail(OTHER_USER_ID, SESSION_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('devuelve session + turns + corrections mapeados a los nombres de la app', async () => {
    const session = sessionFixture();
    const turns: TurnHistoryRow[] = [
      { idx: 0, role: 'tutor', text: 'Hola' },
      { idx: 1, role: 'user', text: 'Hola tutor' },
    ];
    const corrections: Correction[] = [
      {
        id: 'c1',
        session_id: SESSION_ID,
        user_id: USER_ID,
        turn_idx: 1,
        original: 'I go yesterday',
        corrected: 'I went yesterday',
        category: 'past_simple',
        note: null,
        created_at: '2026-09-08T10:05:00.000Z',
      },
    ];
    const { repo } = fakeHistoryRepository({ turns, corrections });
    const service = new SessionsHistoryService(repo, fakeTurnsRepository(session));

    const result = await service.detail(USER_ID, SESSION_ID);

    expect(result.session.id).toBe(SESSION_ID);
    expect(result.turns).toEqual([
      { idx: 0, role: 'tutor', text: 'Hola' },
      { idx: 1, role: 'user', text: 'Hola tutor' },
    ]);
    expect(result.corrections).toEqual([
      {
        original: 'I go yesterday',
        corrected: 'I went yesterday',
        category: 'past_simple',
        note: '', // note nulo → '' (contrato de la app)
      },
    ]);
  });
});
