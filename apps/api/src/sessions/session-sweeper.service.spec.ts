import { Logger } from '@nestjs/common';

import type { CloseSessionArgs, CloseSessionResult } from '../db/rpc.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { SessionSweeperResult } from '../jobs/session-sweeper.js';
import { SessionCloserService, type SessionCloseParams } from './session-closer.service.js';
import type { EndSessionRepository } from './end-session.repository.js';
import { SESSION_SWEEPER_BATCH_LIMIT, SessionSweeperService } from './session-sweeper.service.js';
import type { ActiveSessionRow } from './session-sweeper.repository.js';
import type { SessionSweeperRepository } from './session-sweeper.repository.js';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const NOW_ISO = NOW.toISOString();

function isoMinus(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

function activeSession(overrides: Partial<ActiveSessionRow>): ActiveSessionRow {
  return {
    id: 'session-default',
    userId: 'user-default',
    startedAt: isoMinus(100),
    turnsCount: 0,
    ...overrides,
  };
}

interface FakeSweeperRepoOptions {
  readonly sessions: ActiveSessionRow[];
  /** `sessionId -> created_at` del último turno; ausente = ninguno (usa `started_at`). */
  readonly lastTurnAt?: Record<string, string>;
  readonly findLastTurnCreatedAtImpl?: (sessionId: string) => Promise<string | null>;
}

function fakeSweeperRepository(options: FakeSweeperRepoOptions) {
  const calls = {
    markAbandoned: [] as Array<{ sessionId: string; durationSec: number; endedAtIso: string }>,
  };

  const repo = {
    listActiveSessions: async (_limit: number) => options.sessions,
    findLastTurnCreatedAt: async (sessionId: string) => {
      if (options.findLastTurnCreatedAtImpl) {
        return options.findLastTurnCreatedAtImpl(sessionId);
      }
      return options.lastTurnAt?.[sessionId] ?? null;
    },
    markAbandoned: async (sessionId: string, durationSec: number, endedAtIso: string) => {
      calls.markAbandoned.push({ sessionId, durationSec, endedAtIso });
    },
  };

  return { repo: repo as unknown as SessionSweeperRepository, calls };
}

function fakeCloser(options: { throwFor?: Set<string> } = {}) {
  const calls: SessionCloseParams[] = [];
  const closer = {
    close: async (params: SessionCloseParams) => {
      calls.push(params);
      if (options.throwFor?.has(params.sessionId)) {
        throw new Error(`fallo simulado para ${params.sessionId}`);
      }
      return {
        xp_earned: 42,
        streak: 1,
        is_double_day: false,
        next_is_boss: false,
      } satisfies CloseSessionResult;
    },
  };
  return { closer: closer as unknown as SessionCloserService, calls };
}

describe('SessionSweeperService', () => {
  it('sesión sobre el hard cap (idle bajo) se cierra con XP, con SESSION_HARD_CAP_SEC', async () => {
    const session = activeSession({
      id: 'session-hardcap',
      userId: 'user-1',
      startedAt: isoMinus(800), // por encima de los 720 s del hard cap
      turnsCount: 5,
    });
    const { repo } = fakeSweeperRepository({
      sessions: [session],
      lastTurnAt: { 'session-hardcap': isoMinus(10) }, // conversación reciente: idle bajo
    });
    const { closer, calls } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(calls).toEqual([
      {
        userId: 'user-1',
        sessionId: 'session-hardcap',
        durationSec: 720,
        turnsCount: 5,
        decideBrief: true,
      },
    ]);
    expect(result).toEqual<SessionSweeperResult>({
      closedByHardCap: 1,
      closedAsAbandoned: 0,
      markedAbandoned: 0,
    });
  });

  it('sesión activa sin turnos durante 30 min → abandoned, sin XP ni close_session', async () => {
    const session = activeSession({
      id: 'session-idle',
      userId: 'user-2',
      startedAt: isoMinus(1800), // ABANDON_AFTER_SEC exacto, sin turnos
      turnsCount: 0,
    });
    const { repo, calls: repoCalls } = fakeSweeperRepository({ sessions: [session] });
    const { closer, calls: closerCalls } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(closerCalls).toEqual([]);
    expect(repoCalls.markAbandoned).toEqual([
      { sessionId: 'session-idle', durationSec: 0, endedAtIso: NOW_ISO },
    ]);
    expect(result).toEqual<SessionSweeperResult>({
      closedByHardCap: 0,
      closedAsAbandoned: 0,
      markedAbandoned: 1,
    });
  });

  it('abandonada con 2 turnos y 4 min de conversación → ended con XP, close_session con 240 s', async () => {
    const session = activeSession({
      id: 'session-abandoned-with-xp',
      userId: 'user-3',
      startedAt: isoMinus(3600), // hace una hora
      turnsCount: 2,
    });
    const { repo, calls: repoCalls } = fakeSweeperRepository({
      sessions: [session],
      // último turno 4 min después de empezar; desde entonces, más de 30 min de silencio
      lastTurnAt: { 'session-abandoned-with-xp': isoMinus(3360) },
    });
    const { closer, calls: closerCalls } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(closerCalls).toEqual([
      {
        userId: 'user-3',
        sessionId: 'session-abandoned-with-xp',
        durationSec: 240,
        turnsCount: 2,
        decideBrief: true,
      },
    ]);
    expect(repoCalls.markAbandoned).toEqual([]);
    expect(result).toEqual<SessionSweeperResult>({
      closedByHardCap: 0,
      closedAsAbandoned: 1,
      markedAbandoned: 0,
    });
  });

  it('conversación breve dentro de una sesión abandonada (< MIN_SESSION_SEC) → abandoned sin XP', async () => {
    const session = activeSession({
      id: 'session-abandoned-short',
      userId: 'user-4',
      startedAt: isoMinus(3600),
      turnsCount: 2,
    });
    const { repo, calls: repoCalls } = fakeSweeperRepository({
      sessions: [session],
      // solo 60 s de conversación real, muy por debajo de MIN_SESSION_SEC (180)
      lastTurnAt: { 'session-abandoned-short': isoMinus(3540) },
    });
    const { closer, calls: closerCalls } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(closerCalls).toEqual([]);
    expect(repoCalls.markAbandoned).toEqual([
      { sessionId: 'session-abandoned-short', durationSec: 60, endedAtIso: NOW_ISO },
    ]);
    expect(result.markedAbandoned).toBe(1);
  });

  it('sesión ni sobre el hard cap ni abandonada: se deja como está', async () => {
    const session = activeSession({
      id: 'session-normal',
      userId: 'user-5',
      startedAt: isoMinus(120),
      turnsCount: 1,
    });
    const { repo, calls: repoCalls } = fakeSweeperRepository({
      sessions: [session],
      lastTurnAt: { 'session-normal': isoMinus(5) },
    });
    const { closer, calls: closerCalls } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(closerCalls).toEqual([]);
    expect(repoCalls.markAbandoned).toEqual([]);
    expect(result).toEqual<SessionSweeperResult>({
      closedByHardCap: 0,
      closedAsAbandoned: 0,
      markedAbandoned: 0,
    });
  });

  it('un fallo en una sesión no impide procesar las demás', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const failing = activeSession({
      id: 'session-fails',
      userId: 'user-fail',
      startedAt: isoMinus(800),
      turnsCount: 5,
    });
    const ok = activeSession({
      id: 'session-ok',
      userId: 'user-ok',
      startedAt: isoMinus(800),
      turnsCount: 5,
    });
    const { repo } = fakeSweeperRepository({
      sessions: [failing, ok],
      lastTurnAt: { 'session-fails': isoMinus(10), 'session-ok': isoMinus(10) },
    });
    const { closer, calls } = fakeCloser({ throwFor: new Set(['session-fails']) });
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    const result = await service.run();

    expect(calls.map((c) => c.sessionId)).toEqual(['session-fails', 'session-ok']);
    expect(result).toEqual<SessionSweeperResult>({
      closedByHardCap: 1, // solo la que no falló
      closedAsAbandoned: 0,
      markedAbandoned: 0,
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('pide el lote con SESSION_SWEEPER_BATCH_LIMIT por defecto', async () => {
    const limits: number[] = [];
    const repo = {
      listActiveSessions: async (limit: number) => {
        limits.push(limit);
        return [];
      },
      findLastTurnCreatedAt: async () => null,
      markAbandoned: async () => {},
    } as unknown as SessionSweeperRepository;
    const { closer } = fakeCloser();
    const service = new SessionSweeperService({ repository: repo, closer, now: () => NOW });

    await service.run();

    expect(limits).toEqual([SESSION_SWEEPER_BATCH_LIMIT]);
  });

  it('el encolado del brief se decide igual que en el cierre normal (a través de SessionCloserService real)', async () => {
    const sessionEnoughTurns = activeSession({
      id: 'session-brief',
      userId: 'user-brief',
      startedAt: isoMinus(800),
      turnsCount: 3, // MIN_TURNS_FOR_BRIEF
    });
    const sessionFewTurns = activeSession({
      id: 'session-no-brief',
      userId: 'user-no-brief',
      startedAt: isoMinus(800),
      turnsCount: 1,
    });
    const { repo } = fakeSweeperRepository({
      sessions: [sessionEnoughTurns, sessionFewTurns],
      lastTurnAt: { 'session-brief': isoMinus(10), 'session-no-brief': isoMinus(10) },
    });

    const endSessionCalls = {
      closeSession: [] as CloseSessionArgs[],
      markBriefDone: [] as Array<{ userId: string; sessionId: string }>,
    };
    const endSessionRepository = {
      closeSession: async (args: CloseSessionArgs) => {
        endSessionCalls.closeSession.push(args);
        return {
          xp_earned: 50,
          streak: 1,
          is_double_day: false,
          next_is_boss: false,
        } satisfies CloseSessionResult;
      },
      markBriefDone: async (userId: string, sessionId: string) => {
        endSessionCalls.markBriefDone.push({ userId, sessionId });
      },
    } as unknown as EndSessionRepository;

    const enqueued: string[] = [];
    const jobs: JobDispatcher = {
      enqueueCoachingBrief: async (sessionId: string) => {
        enqueued.push(sessionId);
      },
    };

    const realCloser = new SessionCloserService(endSessionRepository, jobs);
    const service = new SessionSweeperService({ repository: repo, closer: realCloser, now: () => NOW });

    await service.run();

    expect(enqueued).toEqual(['session-brief']);
    expect(endSessionCalls.markBriefDone).toEqual([
      { userId: 'user-no-brief', sessionId: 'session-no-brief' },
    ]);
  });
});
