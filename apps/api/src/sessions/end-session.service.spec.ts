import { ApiException } from '../common/api-error.js';
import type { CloseSessionArgs, CloseSessionResult } from '../db/rpc.js';
import type { Session } from '../db/schema.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { EndSessionDto } from './dto/end-session.dto.js';
import { computeDurationSec, EndSessionService } from './end-session.service.js';
import type { EndSessionRepository } from './end-session.repository.js';
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
    chat_model_used: 'gemini-2.5-flash',
    callback_fact_id: null,
    brief_job_status: 'pending',
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

interface FakeEndSessionRepoOptions {
  readonly closeResult?: CloseSessionResult;
  readonly correctionsCount?: number;
  readonly closeSessionImpl?: (args: CloseSessionArgs) => Promise<CloseSessionResult>;
}

function fakeEndSessionRepository(options: FakeEndSessionRepoOptions = {}) {
  const calls = {
    closeSession: [] as CloseSessionArgs[],
    markBriefDone: [] as Array<{ userId: string; sessionId: string }>,
    countCorrections: [] as string[],
  };

  const repo = {
    closeSession: async (args: CloseSessionArgs) => {
      calls.closeSession.push(args);
      if (options.closeSessionImpl) return options.closeSessionImpl(args);
      return options.closeResult ?? closeResultFixture();
    },
    markBriefDone: async (userId: string, sessionId: string) => {
      calls.markBriefDone.push({ userId, sessionId });
    },
    countCorrections: async (sessionId: string) => {
      calls.countCorrections.push(sessionId);
      return options.correctionsCount ?? 2;
    },
  };

  return { repo: repo as unknown as EndSessionRepository, calls };
}

function fakeJobDispatcher() {
  const enqueued: string[] = [];
  const dispatcher: JobDispatcher = {
    enqueueCoachingBrief: async (sessionId: string) => {
      enqueued.push(sessionId);
    },
  };
  return { dispatcher, enqueued };
}

describe('EndSessionService', () => {
  it('sesión de otro usuario o inexistente → 403 FORBIDDEN, sin llamar a close_session', async () => {
    const turns = fakeTurnsRepository({ session: null });
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

    await expect(service.endSession(OTHER_USER_ID, SESSION_ID, DTO)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(calls.closeSession).toHaveLength(0);
  });

  it('`:id` que no es un UUID → 403 FORBIDDEN antes de tocar el repositorio', async () => {
    const turns = fakeTurnsRepository();
    const { repo } = fakeEndSessionRepository();
    const { dispatcher } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

    await expect(service.endSession(USER_ID, 'no-es-un-uuid', DTO)).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('cierra una sesión activa: llama a close_session con p_turns_count = sessions.turns_count', async () => {
    const session = sessionFixture({ status: 'active', turns_count: 5 });
    const turns = fakeTurnsRepository({ session });
    const { repo, calls } = fakeEndSessionRepository({
      closeResult: closeResultFixture({ xp_earned: 90, streak: 4, is_double_day: true, next_is_boss: true }),
      correctionsCount: 3,
    });
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);

    expect(calls.closeSession[0]).toMatchObject({
      p_session_id: SESSION_ID,
      p_turns_count: 5,
    });
    expect(result.summary).toMatchObject({
      xpEarned: 90,
      streak: 4,
      isDoubleDay: true,
      correctionsCount: 3,
      nextIsBoss: true,
    });
    expect(result.summary.durationSec).toBeGreaterThanOrEqual(0);
    // turns_count (5) >= MIN_TURNS_FOR_BRIEF (3): se encola el job.
    expect(enqueued).toEqual([SESSION_ID]);
  });

  it('turns_count < MIN_TURNS_FOR_BRIEF: no encola el job y marca brief_job_status=done', async () => {
    const session = sessionFixture({ status: 'active', turns_count: 1 });
    const turns = fakeTurnsRepository({ session });
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

    await service.endSession(USER_ID, SESSION_ID, DTO);

    expect(enqueued).toEqual([]);
    expect(calls.markBriefDone).toEqual([{ userId: USER_ID, sessionId: SESSION_ID }]);
  });

  it('un fallo al encolar (Redis caído) no tumba el cierre: responde igual, log warn', async () => {
    const session = sessionFixture({ status: 'active', turns_count: 5 });
    const turns = fakeTurnsRepository({ session });
    const { repo } = fakeEndSessionRepository();
    const dispatcher: JobDispatcher = {
      enqueueCoachingBrief: async () => {
        throw new Error('Redis caído');
      },
    };
    const service = new EndSessionService(turns, repo, dispatcher);

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);
    expect(result.summary.xpEarned).toBe(closeResultFixture().xp_earned);
  });

  it('sesión ya `ended` (idempotente): responde 200 con el resumen ya guardado, sin volver a decidir el brief', async () => {
    const session = sessionFixture({
      status: 'ended',
      ended_at: '2026-09-08T10:20:00.000Z',
      duration_sec: 600,
      turns_count: 6,
      xp_earned: 60,
      brief_job_status: 'done',
    });
    const turns = fakeTurnsRepository({ session });
    const { repo, calls } = fakeEndSessionRepository({
      closeResult: closeResultFixture({ xp_earned: 60, streak: 2, is_double_day: false, next_is_boss: false }),
    });
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

    const result = await service.endSession(USER_ID, SESSION_ID, DTO);

    // Se sigue llamando a close_session (es idempotente), pero no se toca el brief.
    expect(calls.closeSession).toHaveLength(1);
    expect(calls.markBriefDone).toEqual([]);
    expect(enqueued).toEqual([]);
    expect(result.summary.xpEarned).toBe(60);
    expect(result.summary.durationSec).toBe(600); // el guardado, no uno recalculado
  });

  it('sesión `abandoned`, `duration_sec` nulo: durationSec cae a 0', async () => {
    const session = sessionFixture({ status: 'abandoned', duration_sec: null });
    const turns = fakeTurnsRepository({ session });
    const { repo } = fakeEndSessionRepository();
    const { dispatcher } = fakeJobDispatcher();
    const service = new EndSessionService(turns, repo, dispatcher);

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
