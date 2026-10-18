import { ApiException } from '../common/api-error.js';
import type { Interview, Profile, Session } from '../db/schema.js';
import type { I18nService } from '../i18n/i18n.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type {
  InsertInterviewTurnRow,
  InterviewSessionRepository,
  InterviewTurnRow,
} from '../sessions/interview-session.repository.js';
import type { InterviewTurnsService } from '../sessions/interview-turns.service.js';
import type { SessionsRepository } from '../sessions/sessions.repository.js';
import {
  InterviewSessionService,
  WELCOME_BACK_PREFIX,
} from './interview-session.service.js';
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
    resumable?: boolean;
    latest?: Session | null;
    transcript?: InterviewTurnRow[];
    activeSessionId?: string | null;
  } = {},
) {
  let status: InterviewStatus = options.status ?? 'ready';
  let latest: Session | null = options.latest ?? null;
  const transcript: InterviewTurnRow[] = [...(options.transcript ?? [])];
  const calls = {
    created: 0,
    turns: [] as InsertInterviewTurnRow[],
    openings: 0,
  };
  const interview = (): Interview =>
    ({
      id: INTERVIEW_ID,
      user_id: USER_ID,
      status,
      plan: PLAN,
      answered_count: options.answered ?? 0,
      resumable: options.resumable ?? true,
    }) as Interview;

  const repo = {
    findInterview: async () => interview(),
    findLatestSession: async () => latest,
    listTranscript: async () => [...transcript],
    markInProgress: async (_u: string, _i: string, from: InterviewStatus[]) => {
      if (!from.includes(status)) return null;
      status = 'in_progress';
      return interview();
    },
    createSession: async () => {
      calls.created++;
      latest = sessionRow({ id: 'session-new', active_sec: 0, turns_count: 0 });
      return latest;
    },
    insertTurn: async (row: InsertInterviewTurnRow) => {
      calls.turns.push(row);
      transcript.push({
        idx: row.idx,
        role: row.role,
        text: row.text,
        created_at: '',
        question_idx: row.questionIdx,
        is_follow_up: row.isFollowUp,
      });
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
    deleteSession: async () => undefined,
  } as unknown as SessionsRepository;
  const interviewTurns = {
    opening: async () => {
      calls.openings++;
      // Cede el turno: así una segunda petición llega mientras se abre.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { text: "Hi, I'm Sam from Acme. Question 1?", model: 'fluent-free' };
    },
  } as unknown as InterviewTurnsService;
  const config = {
    get: (key: string) => ({ INTERVIEW_MAX_SEC: 600 })[key],
  };
  const i18n = {
    resolveLocale: () => 'es',
    translate: (code: string) => code,
  } as unknown as I18nService;
  const locks = new Set<string>();
  const redis = {
    setIfAbsent: async (key: string) => {
      if (locks.has(key)) return false;
      locks.add(key);
      return true;
    },
    del: async (key: string) => locks.delete(key),
  } as unknown as RedisService;

  const service = new InterviewSessionService(
    repo,
    sessions,
    interviewTurns,
    config as never,
    i18n,
    redis,
  );
  return { service, calls, status: () => status };
}

function tutor(
  idx: number,
  text: string,
  questionIdx: number | null,
  isFollowUp = false,
): InterviewTurnRow {
  return {
    idx,
    role: 'tutor',
    text,
    created_at: '',
    question_idx: questionIdx,
    is_follow_up: isFollowUp,
  };
}

function user(idx: number, questionIdx: number): InterviewTurnRow {
  return {
    idx,
    role: 'user',
    text: 'answer',
    created_at: '',
    question_idx: questionIdx,
    is_follow_up: false,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  return (error as ApiException).code;
}

describe('InterviewSessionService.open', () => {
  it('ready → sesión interview nueva, apertura del modelo y entrevista in_progress', async () => {
    const { service, calls, status } = build({ status: 'ready' });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(status()).toBe('in_progress');
    expect(calls.created).toBe(1);
    expect(calls.openings).toBe(1);
    expect(calls.turns).toEqual([
      expect.objectContaining({
        idx: 0,
        role: 'tutor',
        questionIdx: 1,
        isFollowUp: false,
        model: 'fluent-free',
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

  it('dos POST a la vez (lock interview:session:{id}) → una sola sesión y la misma para los dos', async () => {
    const { service, calls } = build({ status: 'ready' });

    const [a, b] = await Promise.all([
      service.open(USER_ID, INTERVIEW_ID),
      service.open(USER_ID, INTERVIEW_ID),
    ]);

    expect(calls.created).toBe(1);
    expect(calls.turns).toHaveLength(1);
    expect(b.sessionId).toBe(a.sessionId);
    expect(b.opening).toBe(a.opening);
  });

  it('in_progress con la sesión activa → devuelve la misma sesión y el progreso, sin crear nada', async () => {
    const { service, calls } = build({
      status: 'in_progress',
      answered: 2,
      latest: sessionRow({ active_sec: 200 }),
      transcript: [tutor(4, 'Question 3?', 3)],
    });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(calls.created).toBe(0);
    expect(calls.turns).toEqual([]);
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

  it('too_short retomable → misma sesión, in_progress y "welcome back" con la pregunta pendiente', async () => {
    const { service, calls, status } = build({
      status: 'too_short',
      answered: 3,
      latest: sessionRow({ active_sec: 250 }),
      transcript: [user(6, 3), tutor(7, 'Thanks. Next one: Question 4?', 4)],
    });

    const result = await service.open(USER_ID, INTERVIEW_ID);

    expect(status()).toBe('in_progress');
    expect(calls.created).toBe(0);
    expect(calls.openings).toBe(0);
    expect(calls.turns).toEqual([
      {
        sessionId: 'session-1',
        idx: 8,
        role: 'tutor',
        text: `${WELCOME_BACK_PREFIX}Question 4?`,
        questionIdx: 4,
        isFollowUp: false,
      },
    ]);
    expect(result).toMatchObject({
      sessionId: 'session-1',
      answeredCount: 3,
      interview: { questionIdx: 4, remainingSec: 350 },
    });
  });

  it('too_short tras un cierre del modelo → no repite el cierre: pregunta la siguiente del plan', async () => {
    const { service, calls } = build({
      status: 'too_short',
      answered: 2,
      latest: sessionRow(),
      transcript: [user(4, 2), tutor(5, 'Thanks, that is all for today.', null)],
    });

    await service.open(USER_ID, INTERVIEW_ID);

    expect(calls.turns[0]).toMatchObject({
      idx: 6,
      text: `${WELCOME_BACK_PREFIX}Question 3?`,
      questionIdx: 3,
      isFollowUp: false,
    });
  });

  it('retomar una repregunta pendiente la repite sin duplicar el "welcome back"', async () => {
    const { service, calls } = build({
      status: 'too_short',
      answered: 3,
      latest: sessionRow(),
      transcript: [tutor(9, `${WELCOME_BACK_PREFIX}Why that design?`, 3, true)],
    });

    await service.open(USER_ID, INTERVIEW_ID);

    expect(calls.turns[0]).toMatchObject({
      text: `${WELCOME_BACK_PREFIX}Why that design?`,
      questionIdx: 3,
      isFollowUp: true,
    });
  });

  it.each([
    ['sesión cerrada (tope de tiempo o sweeper)', { latest: sessionRow({ status: 'ended' }) }],
    ['resumable = false', { latest: sessionRow(), resumable: false }],
  ])('too_short con %s → 409 INTERVIEW_NOT_RESUMABLE', async (_label, extra) => {
    const { service, calls, status } = build({ status: 'too_short', answered: 2, ...extra });

    expect(await codeOf(service.open(USER_ID, INTERVIEW_ID))).toBe(
      'INTERVIEW_NOT_RESUMABLE',
    );
    expect(status()).toBe('too_short');
    expect(calls.created).toBe(0);
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

    expect(await codeOf(service.open(USER_ID, INTERVIEW_ID))).toBe(
      'SESSION_ALREADY_ACTIVE',
    );
  });
});
