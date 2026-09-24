import type { PushService } from '../push/push.service.js';
import { ApiException } from '../common/api-error.js';
import type { CloseSessionResult } from '../db/rpc.js';
import type { Session } from '../db/schema.js';
import type { EndSessionDto } from './dto/end-session.dto.js';
import { computeDurationSec, EndSessionService } from './end-session.service.js';
import type { EndSessionRepository } from './end-session.repository.js';
import type { SessionCloseParams, SessionCloserService } from './session-closer.service.js';
import type { TurnsRepository } from './turns.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const DTO: EndSessionDto = { reason: 'user' };

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
    turns_count: 4,
    xp_earned: 0,
    chat_model_used: 'fluent-free',
    callback_fact_id: null,
    brief_job_status: 'pending',
    courtesy: false,
    ...overrides,
  };
}

function closeResultFixture(overrides: Partial<CloseSessionResult> = {}): CloseSessionResult {
  return {
    xp_earned: 74,
    streak: 3,
    is_double_day: false,
    next_is_boss: false,
    ...overrides,
  };
}

interface FakeTurnsRepoOptions {
  readonly session?: Session | null;
}

function fakeTurnsRepository(options: FakeTurnsRepoOptions = {}): TurnsRepository {
  return {
    findOwnedSession: async () =>
      options.session === undefined ? sessionFixture() : options.session,
  } as unknown as TurnsRepository;
}

function fakeEndSessionRepository(correctionsCount = 2) {
  const calls = { countCorrections: [] as string[] };
  const repo = {
    countCorrections: async (sessionId: string) => {
      calls.countCorrections.push(sessionId);
      return correctionsCount;
    },
  };
  return { repo: repo as unknown as EndSessionRepository, calls };
}

function fakeSessionCloser(closeResult: CloseSessionResult = closeResultFixture()) {
  const calls: SessionCloseParams[] = [];
  const closer = {
    close: async (params: SessionCloseParams) => {
      calls.push(params);
      return closeResult;
    },
  };
  return { closer: closer as unknown as SessionCloserService, calls };
}

/** PushService falso: registra los avisos de desafío. */
function fakePush() {
  return { notifyChallenge: vi.fn(async () => undefined) } as unknown as PushService;
}

describe('EndSessionService', () => {
  it('sesión de otro usuario o inexistente → 403 FORBIDDEN, sin llamar al closer', async () => {
    const turns = fakeTurnsRepository({ session: null });
    const { repo } = fakeEndSessionRepository();
    const { closer, calls } = fakeSessionCloser();
    const service = new EndSessionService(turns, repo, closer, fakePush());

    await expect(service.endSession(OTHER_USER_ID, SESSION_ID, DTO)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(calls).toHaveLength(0);
  });

  it('`:id` que no es un UUID → 403 FORBIDDEN antes de tocar el repositorio', async () => {
    const turns = fakeTurnsRepository();
    const { repo } = fakeEndSessionRepository();
    const { closer } = fakeSessionCloser();
    const service = new EndSessionService(turns, repo, closer, fakePush());

    await expect(service.endSession(USER_ID, 'no-es-un-uuid', DTO)).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('cierra una sesión activa: delega en el closer con decideBrief=true y turnsCount de la sesión', async () => {
    const session = sessionFixture({ status: 'active', turns_count: 5 });
    const turns = fakeTurnsRepository({ session });
    const { repo } = fakeEndSessionRepository(3);
    const { closer, calls } = fakeSessionCloser(
      closeResultFixture({ xp_earned: 90, streak: 4, is_double_day: true, next_is_boss: true }),
    );
    const service = new EndSessionService(turns, repo, closer, fakePush());

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);

    expect(calls[0]).toMatchObject({
      userId: USER_ID,
      sessionId: SESSION_ID,
      turnsCount: 5,
      decideBrief: true,
    });
    expect(result.summary).toMatchObject({
      xpEarned: 90,
      streak: 4,
      isDoubleDay: true,
      correctionsCount: 3,
      nextIsBoss: true,
    });
    expect(result.summary.durationSec).toBeGreaterThanOrEqual(0);
  });

  it('una sesión válida recién cerrada avisa al grupo; una sin XP o ya cerrada, no', async () => {
    const run = async (status: 'active' | 'ended', xp: number) => {
      const push = fakePush();
      const service = new EndSessionService(
        fakeTurnsRepository({ session: sessionFixture({ status, turns_count: 5 }) }),
        fakeEndSessionRepository(0).repo,
        fakeSessionCloser(closeResultFixture({ xp_earned: xp })).closer,
        push,
      );
      await service.endSession(USER_ID, SESSION_ID, DTO);
      return push.notifyChallenge as unknown as ReturnType<typeof vi.fn>;
    };

    expect(await run('active', 90)).toHaveBeenCalledWith(USER_ID, expect.any(String));
    expect(await run('active', 0)).not.toHaveBeenCalled();
    expect(await run('ended', 90)).not.toHaveBeenCalled();
  });

  it('sesión ya `ended` (idempotente): delega con decideBrief=false y responde el resumen guardado', async () => {
    const session = sessionFixture({
      status: 'ended',
      ended_at: '2026-09-08T10:20:00.000Z',
      duration_sec: 600,
      turns_count: 6,
      xp_earned: 60,
      brief_job_status: 'done',
    });
    const turns = fakeTurnsRepository({ session });
    const { repo } = fakeEndSessionRepository();
    const { closer, calls } = fakeSessionCloser(
      closeResultFixture({ xp_earned: 60, streak: 2, is_double_day: false, next_is_boss: false }),
    );
    const service = new EndSessionService(turns, repo, closer, fakePush());

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);

    // Se sigue llamando al closer (close_session es idempotente), pero con decideBrief=false.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.decideBrief).toBe(false);
    expect(result.summary.xpEarned).toBe(60);
    expect(result.summary.durationSec).toBe(600); // el guardado, no uno recalculado
  });

  it('sesión `abandoned`, `duration_sec` nulo: durationSec cae a 0', async () => {
    const session = sessionFixture({ status: 'abandoned', duration_sec: null });
    const turns = fakeTurnsRepository({ session });
    const { repo } = fakeEndSessionRepository();
    const { closer } = fakeSessionCloser();
    const service = new EndSessionService(turns, repo, closer, fakePush());

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);
    expect(result.summary.durationSec).toBe(0);
  });
});

describe('computeDurationSec', () => {
  it('now - started_at, en segundos', () => {
    const startedAt = '2026-09-08T10:00:00.000Z';
    const now = new Date('2026-09-08T10:05:00.000Z');
    expect(computeDurationSec(startedAt, now)).toBe(300);
  });

  it('nunca negativo (reloj desincronizado)', () => {
    const startedAt = '2026-09-08T10:05:00.000Z';
    const now = new Date('2026-09-08T10:00:00.000Z');
    expect(computeDurationSec(startedAt, now)).toBe(0);
  });

  it('se acota a SESSION_HARD_CAP_SEC (720)', () => {
    const startedAt = '2026-09-08T10:00:00.000Z';
    const now = new Date('2026-09-08T11:00:00.000Z'); // 1 hora después
    expect(computeDurationSec(startedAt, now)).toBe(720);
  });
});
