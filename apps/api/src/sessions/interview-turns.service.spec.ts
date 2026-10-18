import type { Interview, Profile, Session } from '../db/schema.js';
import type { InterviewSessionService } from '../interviews/interview-session.service.js';
import type { InterviewPlan } from '../interviews/interviews.types.js';
import { LlmUnavailableError, type LlmService } from '../llm/llm.service.js';
import type { LlmMessage } from '../llm/types.js';
import type {
  InterviewSessionRepository,
  InterviewTurnRow,
} from './interview-session.repository.js';
import {
  INTERVIEW_CLOSING_REPLY,
  InterviewTurnsService,
} from './interview-turns.service.js';
import type { SessionsRepository } from './sessions.repository.js';
import type { TurnResultDto } from './sessions.types.js';
import { runTurnStream, type SseResponse } from './turn-stream.js';
import type { RecordTurnArgs, TurnsRepository } from './turns.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const INTERVIEW_ID = '33333333-3333-4333-8333-333333333333';
const NOW = Date.now();

function isoAgo(sec: number): string {
  return new Date(NOW - sec * 1000).toISOString();
}

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

const PROFILE = {
  user_id: USER_ID,
  locale: 'es',
  level: 'B1',
  plan: 'free',
  plan_expires_at: null,
} as Profile;

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    kind: 'interview',
    topic: 'Entrevista',
    status: 'active',
    started_at: isoAgo(3600),
    turns_count: 2,
    interview_id: INTERVIEW_ID,
    active_sec: 100,
    ...overrides,
  } as Session;
}

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: INTERVIEW_ID,
    user_id: USER_ID,
    status: 'in_progress',
    plan: PLAN,
    answered_count: 2,
    ...overrides,
  } as Interview;
}

/** Entrevistador preguntó Q3 hace `lastAgoSec` segundos. */
function transcript(
  lastAgoSec = 30,
  last: Partial<InterviewTurnRow> = {},
): InterviewTurnRow[] {
  return [
    {
      role: 'tutor',
      text: 'Q1?',
      created_at: isoAgo(400),
      question_idx: 1,
      is_follow_up: false,
    },
    {
      role: 'user',
      text: 'A1',
      created_at: isoAgo(300),
      question_idx: 1,
      is_follow_up: false,
    },
    {
      role: 'tutor',
      text: 'Q2?',
      created_at: isoAgo(200),
      question_idx: 2,
      is_follow_up: false,
    },
    {
      role: 'user',
      text: 'A2',
      created_at: isoAgo(100),
      question_idx: 2,
      is_follow_up: false,
    },
    {
      role: 'tutor',
      text: 'Q3?',
      created_at: isoAgo(lastAgoSec),
      question_idx: 3,
      is_follow_up: false,
      ...last,
    },
  ];
}

interface Output {
  reply?: string;
  isFollowUp?: boolean;
  done?: boolean;
  corrections?: Array<{
    original: string;
    corrected: string;
    category: string;
    note: string;
  }>;
}

function build(
  options: {
    session?: Session;
    interview?: Interview;
    transcript?: InterviewTurnRow[];
    output?: Output;
    unavailable?: boolean;
  } = {},
) {
  const calls = {
    recordTurn: [] as RecordTurnArgs[],
    tag: [] as Array<{ idx: number; questionIdx: number; isFollowUp: boolean }>,
    activeSec: [] as number[],
    answered: [] as number[],
    closed: [] as Session[],
    messages: [] as LlmMessage[][],
  };
  const repo = {
    findInterview: async () => options.interview ?? interview(),
    listTranscript: async () => options.transcript ?? transcript(),
    insertTurn: async () => undefined,
    tagTurn: async (
      _s: string,
      idx: number,
      questionIdx: number,
      isFollowUp: boolean,
    ) => {
      calls.tag.push({ idx, questionIdx, isFollowUp });
    },
    updateActiveSec: async (_u: string, _s: string, sec: number) => {
      calls.activeSec.push(sec);
    },
    updateAnsweredCount: async (_u: string, _i: string, n: number) => {
      calls.answered.push(n);
    },
  } as unknown as InterviewSessionRepository;
  const turns = {
    recordTurn: async (args: RecordTurnArgs) => {
      calls.recordTurn.push(args);
    },
    deleteTurn: async () => undefined,
  } as unknown as TurnsRepository;
  const sessions = {
    findChatModelPreference: async () => null,
  } as unknown as SessionsRepository;
  const llm = {
    complete: async (request: { messages: LlmMessage[] }) => {
      calls.messages.push(request.messages);
      if (options.unavailable) throw new LlmUnavailableError([]);
      return {
        data: {
          reply: 'Thanks. Question 4?',
          isFollowUp: false,
          done: false,
          corrections: [],
          ...options.output,
        },
        modelUsed: 'fluent-free',
        usage: { tokensIn: 1, tokensOut: 1 },
        attempts: [{ latencyMs: 10 }],
      };
    },
  } as unknown as LlmService;
  const config = {
    get: (key: string) =>
      ({ INTERVIEW_MAX_SEC: 600, INTERVIEW_WARN_SEC: 540, PROMPT_VERSION: 3 })[
        key
      ],
  };
  const interviewSessions = {
    closeSession: async (_u: string, closed: Session) => {
      calls.closed.push(closed);
    },
  } as unknown as InterviewSessionService;

  const service = new InterviewTurnsService(
    repo,
    turns,
    sessions,
    llm,
    config as never,
    interviewSessions,
  );
  const run = (
    onToken?: (delta: string) => void,
    onReset?: () => void,
  ): Promise<TurnResultDto> =>
    service.run({
      userId: USER_ID,
      session: options.session ?? session(),
      profile: PROFILE,
      text: 'My answer',
      userTurnIdx: 5,
      onToken,
      onReset,
    });
  return { run, calls };
}

describe('InterviewTurnsService', () => {
  it('suma el hueco desde el turno anterior a active_sec y responde la siguiente pregunta', async () => {
    const { run, calls } = build({ transcript: transcript(30) });

    const result = await run();

    expect(calls.activeSec).toEqual([130]);
    expect(calls.answered).toEqual([3]);
    expect(calls.tag).toEqual([{ idx: 6, questionIdx: 4, isFollowUp: false }]);
    expect(result.interview).toEqual({
      questionIdx: 4,
      totalQuestions: 8,
      competency: 'Comunicación',
      remainingSec: 470,
      done: false,
    });
  });

  it('una pausa de 10 min solo suma 120 s (D4)', async () => {
    const { run, calls } = build({ transcript: transcript(600) });

    await run();

    expect(calls.activeSec).toEqual([220]);
  });

  it('a 600 s de tiempo activo cierra la sesión aunque el modelo no diga done', async () => {
    const { run, calls } = build({
      session: session({ active_sec: 590 }),
      transcript: transcript(10),
    });

    const result = await run();

    expect(result.interview?.done).toBe(true);
    expect(result.interview?.remainingSec).toBe(0);
    expect(result.reply).toBe(INTERVIEW_CLOSING_REPLY);
    expect(calls.closed).toHaveLength(1);
    expect(calls.closed[0]).toMatchObject({ active_sec: 600, turns_count: 3 });
  });

  it('con done del modelo cierra la sesión', async () => {
    const { run, calls } = build({
      output: { reply: 'Thanks, we are done.', done: true },
    });

    const result = await run();

    expect(result.interview?.done).toBe(true);
    expect(result.reply).toBe('Thanks, we are done.');
    expect(calls.closed).toHaveLength(1);
  });

  it('guarda las correcciones pero no las devuelve (FR-10)', async () => {
    const { run, calls } = build({
      output: {
        corrections: [
          {
            original: 'I go',
            corrected: 'I went',
            category: 'past_simple',
            note: 'Pasado.',
          },
        ],
      },
    });

    const result = await run();

    expect(result.corrections).toEqual([]);
    expect(calls.recordTurn[0]!.corrections).toHaveLength(1);
  });

  it('la respuesta SSE de un turno de entrevista no trae el evento corrections', async () => {
    const { run } = build({
      output: {
        corrections: [
          {
            original: 'I go',
            corrected: 'I went',
            category: 'past_simple',
            note: 'Pasado.',
          },
        ],
      },
    });
    const chunks: string[] = [];
    const res: SseResponse = {
      setHeader: () => undefined,
      write: (chunk: string) => chunks.push(chunk) > 0,
      end: () => undefined,
    };

    await runTurnStream(res, (onToken, onReset) => run(onToken, onReset));

    const body = chunks.join('');
    expect(body).not.toContain('event: corrections');
    expect(body).not.toContain('I went');
    expect(body).toContain('event: done');
  });

  it('una repregunta permitida mantiene la misma pregunta', async () => {
    const { run, calls } = build({
      output: { reply: 'Can you give an example?', isFollowUp: true },
    });

    const result = await run();

    expect(result.reply).toBe('Can you give an example?');
    expect(result.interview?.questionIdx).toBe(3);
    expect(calls.tag).toEqual([{ idx: 6, questionIdx: 3, isFollowUp: true }]);
  });

  it('una segunda repregunta a la misma pregunta se evita: pasa a la siguiente del plan', async () => {
    // Q3 ya tuvo su repregunta y el candidato la acaba de contestar.
    const { run, calls } = build({
      interview: interview({ answered_count: 3 }),
      transcript: transcript(30, { text: 'Why?', is_follow_up: true }),
      output: { reply: 'And why exactly?', isFollowUp: true },
    });
    const tokens: string[] = [];
    let resets = 0;

    const result = await run(
      (delta) => tokens.push(delta),
      () => resets++,
    );

    expect(result.reply).toBe('Thank you. Question 4?');
    expect(result.interview?.questionIdx).toBe(4);
    expect(calls.tag).toEqual([{ idx: 6, questionIdx: 4, isFollowUp: false }]);
    expect(resets).toBe(1);
    expect(tokens.at(-1)).toBe('Thank you. Question 4?');
    expect(calls.messages[0]![0]!.content).toContain(
      'Never follow up on these questions again: Q3',
    );
  });

  it('degradado: repite sin avanzar de pregunta y sin cerrar', async () => {
    const { run, calls } = build({ unavailable: true });

    const result = await run();

    expect(result.degraded).toBe(true);
    expect(result.interview).toMatchObject({ questionIdx: 3, done: false });
    expect(calls.closed).toEqual([]);
  });
});
