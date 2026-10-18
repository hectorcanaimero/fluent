import { ApiException } from '../common/api-error.js';
import type { Interview, Profile, Session } from '../db/schema.js';
import type { I18nService } from '../i18n/i18n.service.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { LlmService } from '../llm/llm.service.js';
import type {
  InsertInterviewTurnRow,
  InterviewSessionRepository,
  InterviewTurnRow,
} from '../sessions/interview-session.repository.js';
import type {
  SessionCloseParams,
  SessionCloserService,
} from '../sessions/session-closer.service.js';
import type { SessionsRepository } from '../sessions/sessions.repository.js';
import { InterviewSessionService } from './interview-session.service.js';
import type { InterviewPlan, InterviewStatus } from './interviews.types.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INTERVIEW_ID = '33333333-3333-4333-8333-333333333333';

const PLAN: InterviewPlan = {
  type: 'technical',
  company: { name: 'Acme' },
  role: 'Backend engineer',
  area: 'engineering',
  seniority: 'semi_senior',
  stack: ['node'],
  rubric: [
    { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior', weight: 1 },
    {
      id: 'c2',
      name: 'Bases de datos',
      expectedLevel: 'semi_senior',
      weight: 1,
    },
    { id: 'c3', name: 'Testing', expectedLevel: 'semi_senior', weight: 1 },
    { id: 'c4', name: 'Comunicación', expectedLevel: 'semi_senior', weight: 1 },
  ],
  questions: Array.from({ length: 8 }, (_unused, i) => ({
    idx: i + 1,
    competencyId: `c${(i % 4) + 1}`,
    kind: 'technical' as const,
    text: `Question ${i + 1}?`,
  })),
};

function sessionRow(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    user_id: USER_ID,
    kind: 'interview',
    topic: 'Entrevista',
    status: 'active',
    started_at: '2026-10-18T10:00:00.000Z',
    turns_count: 3,
    interview_id: INTERVIEW_ID,
    active_sec: 200,
    ...overrides,
  } as Session;
}

function build(
  options: {
    status?: InterviewStatus;
    answered?: number;
    latest?: Session | null;
    transcript?: InterviewTurnRow[];
    activeSessionId?: string | null;
  } = {},
) {
  let status: InterviewStatus = options.status ?? 'ready';
  const calls = {
    created: [] as number[],
    turns: [] as InsertInterviewTurnRow[],
    finished: [] as string[],
    closed: [] as SessionCloseParams[],
    llm: 0,
    enqueuedFeedback: [] as string[],
  };
  const interview = (): Interview =>
    ({
      id: INTERVIEW_ID,
      user_id: USER_ID,
      status,
      plan: PLAN,
      answered_count: options.answered ?? 0,
    }) as Interview;

  const repo = {
    findInterview: async () => interview(),
    findLatestSession: async () => options.latest ?? null,
    listTranscript: async () => options.transcript ?? [],
    markInProgress: async (_u: string, _i: string, from: InterviewStatus[]) => {
      if (!from.includes(status)) return null;
      status = 'in_progress';
      return interview();
    },
    createSession: async (_u: string, _i: string, activeSec: number) => {
      calls.created.push(activeSec);
      return sessionRow({
        id: 'session-new',
        active_sec: activeSec,
        turns_count: 0,
      });
    },
    insertTurn: async (row: InsertInterviewTurnRow) => {
      calls.turns.push(row);
    },
    finishInterview: async (
      _u: string,
      _i: string,
      next: 'feedback_pending' | 'too_short',
    ) => {
      calls.finished.push(next);
      status = next;
    },
  } as unknown as InterviewSessionRepository;
  const sessions = {
    findProfile: async () =>
      ({
        user_id: USER_ID,
        locale: 'es',
        onboarded_at: '2026-09-01',
        plan: 'free',
      }) as Profile,
    findActiveSessionId: async () => options.activeSessionId ?? null,
    findChatModelPreference: async () => null,
    deleteSession: async () => undefined,
  } as unknown as SessionsRepository;
  const closer = {
    close: async (params: SessionCloseParams) => {
      calls.closed.push(params);
      return {
        xp_earned: 0,
        streak: 0,
        is_double_day: false,
        next_is_boss: false,
        newBadges: [],
      };
    },
  } as unknown as SessionCloserService;
  const llm = {
    complete: async () => {
      calls.llm++;
      return {
        data: {
          reply: "Hi, I'm Sam from Acme. Question 1?",
          questionIdx: 1,
          isFollowUp: false,
          done: false,
          corrections: [],
        },
        modelUsed: 'fluent-free',
        usage: { tokensIn: 1, tokensOut: 1 },
        attempts: [],
      };
    },
  } as unknown as LlmService;
  const config = {
    get: (key: string) =>
      ({ INTERVIEW_MAX_SEC: 600, INTERVIEW_WARN_SEC: 540, PROMPT_VERSION: 3 })[
        key
      ],
  };
  const i18n = {
    resolveLocale: () => 'es',
    translate: (code: string) => code,
  } as unknown as I18nService;
  const jobs = {
    enqueueCoachingBrief: async () => {},
    enqueueInterviewPrepare: async () => {},
    enqueueInterviewFeedback: async (interviewId: string) => {
      calls.enqueuedFeedback.push(interviewId);
    },
  } as unknown as JobDispatcher;

  const service = new InterviewSessionService(
    repo,
    sessions,
    closer,
    llm,
    config as never,
    i18n,
    jobs,
  );
  return { service, calls, status: () => status };
}

describe('InterviewSessionService.open', () => {
  it('ready → sesión interview nueva, apertura del modelo y entrevista in_progress', async () => {
    const { service, calls, status } = build({ status: 'ready' });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(status()).toBe('in_progress');
    expect(calls.created).toEqual([0]);
    expect(calls.llm).toBe(1);
    expect(calls.turns).toEqual([
      expect.objectContaining({
        idx: 0,
        role: 'tutor',
        questionIdx: 1,
        isFollowUp: false,
      }),
    ]);
    expect(result).toEqual({
      sessionId: 'session-new',
      opening: "Hi, I'm Sam from Acme. Question 1?",
      answeredCount: 0,
      interview: {
        questionIdx: 1,
        totalQuestions: 8,
        competency: 'APIs',
        remainingSec: 600,
        done: false,
      },
    });
  });

  it('in_progress con la sesión activa → devuelve la misma sesión y el progreso, sin crear nada', async () => {
    const { service, calls } = build({
      status: 'in_progress',
      answered: 2,
      latest: sessionRow({ active_sec: 200 }),
      transcript: [
        {
          role: 'tutor',
          text: 'Question 3?',
          created_at: '',
          question_idx: 3,
          is_follow_up: false,
        },
      ],
    });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(calls.created).toEqual([]);
    expect(calls.llm).toBe(0);
    expect(result).toEqual({
      sessionId: 'session-1',
      opening: 'Question 3?',
      answeredCount: 2,
      interview: {
        questionIdx: 3,
        totalQuestions: 8,
        competency: 'Testing',
        remainingSec: 400,
        done: false,
      },
    });
  });

  it('too_short → vuelve a in_progress con otra sesión que arrastra active_sec y repite la pregunta pendiente', async () => {
    const { service, calls, status } = build({
      status: 'too_short',
      answered: 3,
      latest: sessionRow({ status: 'ended', active_sec: 250 }),
      transcript: [
        {
          role: 'tutor',
          text: 'Question 4?',
          created_at: '',
          question_idx: 4,
          is_follow_up: false,
        },
      ],
    });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(status()).toBe('in_progress');
    expect(calls.created).toEqual([250]);
    expect(calls.llm).toBe(0);
    expect(calls.turns[0]).toMatchObject({
      idx: 0,
      questionIdx: 4,
      text: expect.stringContaining('Question 4?'),
    });
    expect(result.interview).toMatchObject({
      questionIdx: 4,
      remainingSec: 350,
    });
  });

  it.each([
    'preparing',
    'prep_failed',
    'feedback_pending',
    'feedback_ready',
    'feedback_failed',
  ] as const)('%s → 409 INTERVIEW_NOT_OPENABLE', async (initial) => {
    const { service } = build({ status: initial });

    const error = await service
      .open(USER_ID, INTERVIEW_ID)
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('INTERVIEW_NOT_OPENABLE');
    expect((error as ApiException).getApiBody().statusCode).toBe(409);
  });

  it('con otra sesión activa → 409 SESSION_ALREADY_ACTIVE', async () => {
    const { service } = build({ status: 'ready', activeSessionId: 'other' });

    const error = await service
      .open(USER_ID, INTERVIEW_ID)
      .catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('SESSION_ALREADY_ACTIVE');
  });
});

describe('InterviewSessionService.closeSession', () => {
  it('con 3 respuestas → too_short, sin encolar el parecer', async () => {
    const { service, calls, status } = build({
      status: 'in_progress',
      answered: 3,
    });
    const hook = vi.spyOn(service, 'onInterviewSessionClosed');

    await service.closeSession(USER_ID, sessionRow({ active_sec: 300 }), true);

    expect(calls.closed).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        durationSec: 300,
        decideBrief: true,
      }),
    ]);
    expect(status()).toBe('too_short');
    expect(hook).not.toHaveBeenCalled();
  });

  it('con 4 respuestas → feedback_pending, llama al hook y encola el parecer (F12.3.T1)', async () => {
    const { service, calls, status } = build({ status: 'in_progress', answered: 4 });
    const hook = vi.spyOn(service, 'onInterviewSessionClosed');

    await service.closeSession(USER_ID, sessionRow(), true);

    expect(status()).toBe('feedback_pending');
    expect(hook).toHaveBeenCalledWith(INTERVIEW_ID);
    expect(calls.enqueuedFeedback).toEqual([INTERVIEW_ID]);
  });

  it('sesión ya cerrada (decide = false) → no toca la entrevista', async () => {
    const { service, calls } = build({ status: 'in_progress', answered: 5 });

    await service.closeSession(USER_ID, sessionRow({ status: 'ended' }), false);

    expect(calls.finished).toEqual([]);
  });
});
