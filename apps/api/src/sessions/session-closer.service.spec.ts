import { Logger } from '@nestjs/common';

import type { CloseSessionArgs, CloseSessionResult } from '../db/rpc.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import { SessionCloserService } from './session-closer.service.js';
import type { EndSessionRepository } from './end-session.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function closeResultFixture(overrides: Partial<CloseSessionResult> = {}): CloseSessionResult {
  return {
    xp_earned: 74,
    streak: 3,
    is_double_day: false,
    next_is_boss: false,
    ...overrides,
  };
}

interface FakeEndSessionRepoOptions {
  readonly closeResult?: CloseSessionResult;
}

function fakeEndSessionRepository(options: FakeEndSessionRepoOptions = {}) {
  const calls = {
    closeSession: [] as CloseSessionArgs[],
    markBriefDone: [] as Array<{ userId: string; sessionId: string }>,
  };

  const repo = {
    closeSession: async (args: CloseSessionArgs) => {
      calls.closeSession.push(args);
      return options.closeResult ?? closeResultFixture();
    },
    markBriefDone: async (userId: string, sessionId: string) => {
      calls.markBriefDone.push({ userId, sessionId });
    },
  };

  return { repo: repo as unknown as EndSessionRepository, calls };
}

function fakeJobDispatcher(impl?: (sessionId: string) => Promise<void>) {
  const enqueued: string[] = [];
  const dispatcher: JobDispatcher = {
    enqueueCoachingBrief: async (sessionId: string) => {
      enqueued.push(sessionId);
      if (impl) await impl(sessionId);
    },
  };
  return { dispatcher, enqueued };
}

describe('SessionCloserService', () => {
  it('siempre llama a close_session con los argumentos recibidos', async () => {
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher } = fakeJobDispatcher();
    const service = new SessionCloserService(repo, dispatcher);

    await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 5,
      decideBrief: true,
    });

    expect(calls.closeSession).toEqual([
      { p_session_id: SESSION_ID, p_duration_sec: 240, p_turns_count: 5 },
    ]);
  });

  it('turnsCount >= MIN_TURNS_FOR_BRIEF (3) y decideBrief: encola coaching-brief', async () => {
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new SessionCloserService(repo, dispatcher);

    await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 3,
      decideBrief: true,
    });

    expect(enqueued).toEqual([SESSION_ID]);
    expect(calls.markBriefDone).toEqual([]);
  });

  it('turnsCount < MIN_TURNS_FOR_BRIEF y decideBrief: no encola, marca brief_job_status=done', async () => {
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new SessionCloserService(repo, dispatcher);

    await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 2,
      decideBrief: true,
    });

    expect(enqueued).toEqual([]);
    expect(calls.markBriefDone).toEqual([{ userId: USER_ID, sessionId: SESSION_ID }]);
  });

  it('decideBrief: false → no encola ni marca brief_job_status, pero sí cierra', async () => {
    const { repo, calls } = fakeEndSessionRepository();
    const { dispatcher, enqueued } = fakeJobDispatcher();
    const service = new SessionCloserService(repo, dispatcher);

    await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 5,
      decideBrief: false,
    });

    expect(calls.closeSession).toHaveLength(1);
    expect(enqueued).toEqual([]);
    expect(calls.markBriefDone).toEqual([]);
  });

  it('un fallo al encolar (Redis caído) no tumba el cierre: log warn y sigue', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { repo } = fakeEndSessionRepository({ closeResult: closeResultFixture({ xp_earned: 90 }) });
    const { dispatcher } = fakeJobDispatcher(async () => {
      throw new Error('Redis caído');
    });
    const service = new SessionCloserService(repo, dispatcher);

    const result = await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 5,
      decideBrief: true,
    });

    expect(result.xp_earned).toBe(90);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('coaching-brief');
    warnSpy.mockRestore();
  });

  it('devuelve el resultado de close_session tal cual', async () => {
    const { repo } = fakeEndSessionRepository({
      closeResult: closeResultFixture({ xp_earned: 12, streak: 7, is_double_day: true, next_is_boss: true }),
    });
    const { dispatcher } = fakeJobDispatcher();
    const service = new SessionCloserService(repo, dispatcher);

    const result = await service.close({
      userId: USER_ID,
      sessionId: SESSION_ID,
      durationSec: 240,
      turnsCount: 1,
      decideBrief: true,
    });

    expect(result).toEqual({ xp_earned: 12, streak: 7, is_double_day: true, next_is_boss: true });
  });
});
