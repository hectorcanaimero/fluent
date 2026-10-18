import type { Interview, Profile, Session } from '../db/schema.js';
import type { InterviewStatus } from '../interviews/interviews.types.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import { InterviewCloserService } from './interview-closer.service.js';
import type { InterviewSessionRepository } from './interview-session.repository.js';
import type {
  SessionCloseParams,
  SessionCloserService,
} from './session-closer.service.js';
import type { SessionsRepository } from './sessions.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INTERVIEW_ID = '33333333-3333-4333-8333-333333333333';

function sessionRow(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    user_id: USER_ID,
    kind: 'interview',
    status: 'active',
    turns_count: 3,
    interview_id: INTERVIEW_ID,
    active_sec: 200,
    ...overrides,
  } as Session;
}

function build(
  options: { status?: InterviewStatus; answered?: number; enqueueFails?: boolean } = {},
) {
  const enqueued: string[] = [];
  const failedEnqueue: string[] = [];
  let status: InterviewStatus = options.status ?? 'in_progress';
  let resumable = true;
  const closed: SessionCloseParams[] = [];
  const repo = {
    findInterview: async () =>
      ({
        id: INTERVIEW_ID,
        user_id: USER_ID,
        status,
        answered_count: options.answered ?? 0,
        resumable,
      }) as Interview,
    finishInterview: async (
      _u: string,
      _i: string,
      next: 'feedback_pending' | 'too_short',
      nextResumable: boolean,
    ) => {
      status = next;
      resumable = nextResumable;
    },
    markFeedbackEnqueueFailed: async (id: string) => {
      failedEnqueue.push(id);
      status = 'feedback_failed';
    },
  } as unknown as InterviewSessionRepository;
  const jobs = {
    enqueueInterviewFeedback: async (id: string) => {
      if (options.enqueueFails) throw new Error('redis caído');
      enqueued.push(id);
    },
  } as unknown as JobDispatcher;
  const closer = {
    close: async (params: SessionCloseParams) => {
      closed.push(params);
      return {
        xp_earned: 30,
        streak: 5,
        is_double_day: false,
        next_is_boss: false,
        newBadges: [],
      };
    },
  } as unknown as SessionCloserService;
  const sessions = {
    findProfile: async () => ({ streak: 5 }) as Profile,
  } as unknown as SessionsRepository;
  const config = { get: () => 600 };

  const service = new InterviewCloserService(
    repo,
    closer,
    sessions,
    config as never,
    jobs,
  );
  return {
    service,
    closed,
    enqueued,
    failedEnqueue,
    state: () => ({ status, resumable }),
  };
}

describe('InterviewCloserService.end (Terminar, done del modelo)', () => {
  it('< 4 respuestas y tiempo por delante → too_short retomable sin cerrar la sesión ni dar XP', async () => {
    const { service, closed, state } = build({ answered: 3 });

    const result = await service.end(USER_ID, sessionRow({ active_sec: 300 }), true);

    expect(closed).toEqual([]);
    expect(state()).toEqual({ status: 'too_short', resumable: true });
    expect(result).toMatchObject({ xp_earned: 0, streak: 5, newBadges: [] });
  });

  it('< 4 respuestas con el tope de tiempo agotado → cierra una vez y too_short no retomable', async () => {
    const { service, closed, state } = build({ answered: 2 });

    await service.end(USER_ID, sessionRow({ active_sec: 600 }), true);

    expect(closed).toHaveLength(1);
    expect(state()).toEqual({ status: 'too_short', resumable: false });
  });

  it('≥ 4 respuestas → cierra (duración = active_sec) y feedback_pending con el hook del parecer', async () => {
    const { service, closed, state } = build({ answered: 4 });
    const hook = vi.spyOn(service, 'onInterviewSessionClosed');

    await service.end(USER_ID, sessionRow({ active_sec: 300 }), true);

    expect(closed).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        durationSec: 300,
        decideBrief: true,
      }),
    ]);
    expect(state().status).toBe('feedback_pending');
    expect(hook).toHaveBeenCalledWith(INTERVIEW_ID);
  });

  it('sesión ya cerrada (wasActive = false) → close_session idempotente, sin tocar la entrevista', async () => {
    const { service, closed, state } = build({ status: 'too_short', answered: 2 });

    await service.end(USER_ID, sessionRow({ status: 'ended' }), false);

    expect(closed).toEqual([expect.objectContaining({ decideBrief: false })]);
    expect(state()).toEqual({ status: 'too_short', resumable: true });
  });
});

describe('InterviewCloserService.closeSession (tope, 8 respuestas, sweeper)', () => {
  it('cierra una entrevista en pausa (too_short) → too_short no retomable', async () => {
    const { service, closed, state } = build({ status: 'too_short', answered: 3 });
    const hook = vi.spyOn(service, 'onInterviewSessionClosed');

    await service.closeSession(USER_ID, sessionRow(), true);

    expect(closed).toHaveLength(1);
    expect(state()).toEqual({ status: 'too_short', resumable: false });
    expect(hook).not.toHaveBeenCalled();
  });

  it('≥ 4 respuestas (tope o sweeper) → feedback_pending y encola interview-feedback (F12.3.T1)', async () => {
    const { service, enqueued, state } = build({ answered: 5 });

    await service.closeSession(USER_ID, sessionRow(), true);

    expect(state().status).toBe('feedback_pending');
    expect(enqueued).toEqual([INTERVIEW_ID]);
  });

  it('too_short → no encola el parecer', async () => {
    const { service, enqueued } = build({ answered: 2 });

    await service.closeSession(USER_ID, sessionRow(), true);

    expect(enqueued).toEqual([]);
  });

  it('si el encolado falla → feedback_failed (reintentable) sin tumbar el cierre', async () => {
    const { service, closed, failedEnqueue, state } = build({ answered: 4, enqueueFails: true });

    await expect(service.closeSession(USER_ID, sessionRow(), true)).resolves.toBeDefined();

    expect(closed).toHaveLength(1);
    expect(failedEnqueue).toEqual([INTERVIEW_ID]);
    expect(state().status).toBe('feedback_failed');
  });
});
