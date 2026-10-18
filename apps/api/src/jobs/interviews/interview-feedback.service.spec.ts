import type { ConfigService } from '@nestjs/config';

import {
  AgentInvalidResponseError,
  AgentUnavailableError,
  type InterviewAgentClient,
} from '../../interviews/interview-agent.client.js';
import type { FeedbackRequest, InterviewFeedback, InterviewPlan } from '../../interviews/interviews.types.js';
import type { MemoryRepository } from '../../memory/memory.repository.js';
import type { PushService } from '../../push/push.service.js';
import { ProfileMissingError } from './interview-prepare.repository.js';
import { classifyFeedbackError, InterviewFeedbackService } from './interview-feedback.service.js';
import type {
  EnglishErrorRow,
  InterviewFeedbackRepository,
  InterviewFeedbackRow,
  RecordFeedbackUsageInput,
  SessionDataResult,
} from './interview-feedback.repository.js';

const INTERVIEW_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_ID = '33333333-3333-4333-8333-333333333333';

function makeConfig(promptVersion = 3): ConfigService<never, true> {
  return {
    get: (key: string) => (key === 'PROMPT_VERSION' ? promptVersion : undefined),
  } as unknown as ConfigService<never, true>;
}

function planFixture(): InterviewPlan {
  return {
    type: 'technical',
    company: { name: 'Acme' },
    role: 'Backend engineer',
    area: 'engineering',
    seniority: 'semi_senior',
    stack: ['node'],
    rubric: [
      { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c2', name: 'Testing', expectedLevel: 'semi_senior', weight: 1 },
    ],
    questions: Array.from({ length: 8 }, (_unused, i) => ({
      idx: i + 1,
      competencyId: i % 2 === 0 ? 'c1' : 'c2',
      kind: 'technical' as const,
      text: `Question ${i + 1}`,
    })),
  };
}

interface RepoState {
  status: InterviewFeedbackRow['status'];
}

function makeRepository(
  state: RepoState,
  options: {
    readonly parentInterviewId?: string | null;
    readonly transcript?: SessionDataResult;
    readonly englishErrors?: EnglishErrorRow[];
    readonly parentFeedback?: InterviewFeedback | null;
    readonly profile?: { display_name: string; locale: 'es' | 'pt-BR' } | null;
  } = {},
) {
  const interview = {
    id: INTERVIEW_ID,
    user_id: USER_ID,
    parent_interview_id: options.parentInterviewId ?? null,
    plan: planFixture(),
    role: 'Backend engineer',
    company: { name: 'Acme' },
    answered_count: 5,
    get status() {
      return state.status;
    },
  };

  const defaultTranscript: SessionDataResult = {
    sessionIds: ['session-1'],
    transcript: [
      { role: 'tutor', text: 'Tell me about caching.', question_idx: 1 },
      { role: 'user', text: 'I used Redis for caching sessions.', question_idx: 1 },
    ],
  };

  const saved: InterviewFeedback[] = [];
  const failed: string[] = [];
  const usage: RecordFeedbackUsageInput[] = [];
  const locks = new Map<string, string>();

  const repository = {
    acquireFeedbackLock: vi.fn(async (id: string, owner: string) => {
      const holder = locks.get(id);
      if (holder !== undefined && holder !== owner) return false;
      locks.set(id, owner);
      return true;
    }),
    releaseFeedbackLock: vi.fn(async (id: string, owner: string) => {
      if (locks.get(id) === owner) locks.delete(id);
    }),
    loadInterview: vi.fn(async () => interview as unknown as InterviewFeedbackRow),
    loadProfile: vi.fn(
      async () => (options.profile === undefined ? { display_name: 'Ana', locale: 'es' as const } : options.profile),
    ),
    loadSessionData: vi.fn(async () => options.transcript ?? defaultTranscript),
    loadEnglishErrors: vi.fn(async () => options.englishErrors ?? []),
    loadParentFeedback: vi.fn(async () => options.parentFeedback ?? null),
    saveFeedback: vi.fn(async (_id: string, feedback: InterviewFeedback) => {
      saved.push(feedback);
      state.status = 'feedback_ready';
    }),
    markFeedbackFailed: vi.fn(async (_id: string, errorCode: string) => {
      failed.push(errorCode);
      state.status = 'feedback_failed';
    }),
    recordFeedbackUsage: vi.fn(async (input: RecordFeedbackUsageInput) => {
      usage.push(input);
    }),
  };

  return { repository, saved, failed, usage };
}

function makeMemory() {
  const facts: Array<{ userId: string; text: string; happensOn: string | null }> = [];
  const errors: Array<{ userId: string; errors: unknown }> = [];
  const memory = {
    addPendingFactIfNew: vi.fn(async (userId: string, text: string, happensOn: string | null) => {
      facts.push({ userId, text, happensOn });
    }),
    addRecurringErrors: vi.fn(async (userId: string, recurringErrors: unknown) => {
      errors.push({ userId, errors: recurringErrors });
    }),
  };
  return { memory, facts, errors };
}

function makePush() {
  const ready: unknown[] = [];
  const push = {
    notifyInterviewFeedbackReady: vi.fn(async (...args: unknown[]) => {
      ready.push(args);
    }),
  };
  return { push, ready };
}

/** Dos competencias: una con evidencia real (subcadena del candidato) y otra inventada. */
function feedbackResponse(overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    summary: 'Buen manejo de caching, a reforzar testing.',
    competencies: [
      {
        competencyId: 'c1',
        observedLevel: 'semi_senior',
        expectedLevel: 'semi_senior',
        evidence: 'I used Redis for caching',
        missing: 'nada',
        study: 'nada',
        verified: true,
      },
      {
        competencyId: 'c2',
        observedLevel: 'junior',
        expectedLevel: 'semi_senior',
        evidence: 'This evidence was never said by the candidate',
        missing: 'testing',
        study: 'testing',
        verified: false,
      },
    ],
    english: {
      clarity: { rating: 'good', note: 'Clara' },
      vocabulary: { rating: 'good', note: 'Variado' },
      errors: [{ original: 'I go yesterday', corrected: 'I went yesterday', explanation: 'past simple' }],
    },
    comparison: null,
    studyPlan: Array.from({ length: 5 }, (_unused, i) => ({
      idx: i + 1,
      focus: 'c1',
      title: `Sesión ${i + 1}`,
      format: 'guided' as const,
      estMin: 20,
      brief: 'Brief',
    })),
    usage: { model: 'fluent-pro', inputTokens: 400, outputTokens: 200, searchCalls: 1 },
    ...overrides,
  };
}

function makeAgent(resolveWith: () => Promise<InterviewFeedback>): InterviewAgentClient {
  return { feedback: vi.fn(resolveWith) } as unknown as InterviewAgentClient;
}

describe('InterviewFeedbackService.run', () => {
  it('descarta la competencia con evidencia inventada, guarda el resto, registra uso, memoria y push', async () => {
    const { repository, saved, usage } = makeRepository({ status: 'feedback_pending' });
    const { memory, facts, errors } = makeMemory();
    const { push, ready } = makePush();
    const agent = makeAgent(async () => feedbackResponse());
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'ready' });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.competencies).toHaveLength(1);
    expect(saved[0]!.competencies[0]!.competencyId).toBe('c1');

    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      userId: USER_ID,
      purpose: 'interview_feedback',
      model: 'fluent-pro',
      tokensIn: 400,
      tokensOut: 200,
      attempt: 1,
      promptVersion: 3,
    });

    expect(facts).toEqual([
      { userId: USER_ID, text: 'Se prepara para una entrevista de Backend engineer en Acme', happensOn: null },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.userId).toBe(USER_ID);

    expect(ready).toHaveLength(1);
    expect(ready[0]).toEqual([USER_ID, INTERVIEW_ID, 'Acme']);
  });

  it('manda el request de I1 con transcript interviewer/candidate, englishErrors y sin previousFeedback', async () => {
    const { repository } = makeRepository({ status: 'feedback_pending' });
    const { memory } = makeMemory();
    const { push } = makePush();
    let captured: FeedbackRequest | undefined;
    const agent = {
      feedback: vi.fn(async (req: FeedbackRequest) => {
        captured = req;
        return feedbackResponse();
      }),
    } as unknown as InterviewAgentClient;
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(captured?.previousFeedback).toBeNull();
    expect(captured?.learnerName).toBe('Ana');
    expect(captured?.locale).toBe('es');
    expect(captured?.transcript).toEqual([
      { role: 'interviewer', questionIdx: 1, text: 'Tell me about caching.' },
      { role: 'candidate', questionIdx: 1, text: 'I used Redis for caching sessions.' },
    ]);
    expect(captured?.englishErrors).toEqual([]);
  });

  it('con parent_interview_id manda previousFeedback', async () => {
    const parentFeedback = feedbackResponse({ summary: 'Parecer anterior.' });
    const { repository } = makeRepository(
      { status: 'feedback_pending' },
      { parentInterviewId: PARENT_ID, parentFeedback },
    );
    const { memory } = makeMemory();
    const { push } = makePush();
    let captured: FeedbackRequest | undefined;
    const agent = {
      feedback: vi.fn(async (req: FeedbackRequest) => {
        captured = req;
        return feedbackResponse();
      }),
    } as unknown as InterviewAgentClient;
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(captured?.previousFeedback).toEqual(parentFeedback);
  });

  it('recupera la `category` original de las correcciones guardadas por texto, o `other` si el agente reformuló', async () => {
    const { repository } = makeRepository(
      { status: 'feedback_pending' },
      { englishErrors: [{ original: 'I go yesterday', corrected: 'I went yesterday', category: 'past_simple' }] },
    );
    const { memory, errors } = makeMemory();
    const { push } = makePush();
    const agent = makeAgent(async () =>
      feedbackResponse({
        english: {
          clarity: { rating: 'good', note: '' },
          vocabulary: { rating: 'good', note: '' },
          errors: [
            { original: 'I go yesterday', corrected: 'I went yesterday', explanation: 'past simple' },
            { original: 'reformulated text', corrected: 'fixed', explanation: 'other' },
          ],
        },
      }),
    );
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(errors[0]!.errors).toEqual([
      { category: 'past_simple', example: 'I go yesterday' },
      { category: 'other', example: 'reformulated text' },
    ]);
  });

  it('no procesa una entrevista que ya no está feedback_pending (idempotencia)', async () => {
    const { repository } = makeRepository({ status: 'feedback_ready' });
    const { memory } = makeMemory();
    const { push } = makePush();
    const agent = makeAgent(async () => feedbackResponse());
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'skipped', reason: 'not_pending' });
    expect(agent.feedback).not.toHaveBeenCalled();
  });

  it('entrevista inexistente: se omite', async () => {
    const { repository } = makeRepository({ status: 'feedback_pending' });
    repository.loadInterview = vi.fn(async () => null) as never;
    const { memory } = makeMemory();
    const { push } = makePush();
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      makeAgent(async () => feedbackResponse()),
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'skipped', reason: 'interview_not_found' });
  });

  it('sin perfil: ProfileMissingError (no reintentable)', async () => {
    const { repository } = makeRepository({ status: 'feedback_pending' }, { profile: null });
    const { memory } = makeMemory();
    const { push } = makePush();
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      makeAgent(async () => feedbackResponse()),
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toBeInstanceOf(ProfileMissingError);
  });

  it('agente caído: se propaga sin guardar ni avisar (lo reintenta BullMQ)', async () => {
    const { repository, saved } = makeRepository({ status: 'feedback_pending' });
    const { memory, facts } = makeMemory();
    const { push, ready } = makePush();
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      makeAgent(async () => {
        throw new AgentUnavailableError('timeout');
      }),
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toBeInstanceOf(AgentUnavailableError);
    expect(saved).toEqual([]);
    expect(facts).toEqual([]);
    expect(ready).toEqual([]);
  });

  it('dos jobs concurrentes de la misma entrevista: solo uno llama al agente', async () => {
    const { repository } = makeRepository({ status: 'feedback_pending' });
    const { memory } = makeMemory();
    const { push } = makePush();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const agent = makeAgent(async () => {
      await gate;
      return feedbackResponse();
    });
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      agent,
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    const first = service.run(INTERVIEW_ID, 1, 'job-1');
    const second = await service.run(INTERVIEW_ID, 1, 'job-2');
    release();

    expect(second).toEqual({ status: 'skipped', reason: 'locked' });
    expect(await first).toEqual({ status: 'ready' });
    expect(agent.feedback).toHaveBeenCalledTimes(1);
  });
});

describe('classifyFeedbackError', () => {
  it.each([
    [new AgentUnavailableError('x'), 'agent_unavailable', true],
    [new AgentInvalidResponseError('x'), 'agent_invalid_response', false],
    [new ProfileMissingError('x'), 'profile_missing', false],
    [new Error('InsForge caído'), 'internal', true],
    [undefined, 'internal', true],
  ])('%s -> %s (reintentable: %s)', (error, code, retryable) => {
    expect(classifyFeedbackError(error)).toEqual({ code, retryable });
  });
});

describe('InterviewFeedbackService.markFailedFinal', () => {
  it('tras agotar los reintentos: feedback_failed, sin push (F12.3.T1)', async () => {
    const { repository, failed } = makeRepository({ status: 'feedback_pending' });
    const { memory } = makeMemory();
    const { push, ready } = makePush();
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      makeAgent(async () => feedbackResponse()),
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.markFailedFinal(INTERVIEW_ID, 'agent_unavailable');

    expect(failed).toEqual(['agent_unavailable']);
    expect(ready).toEqual([]);
  });

  it('no hace nada si la entrevista ya no está feedback_pending', async () => {
    const { repository, failed } = makeRepository({ status: 'feedback_ready' });
    const { memory } = makeMemory();
    const { push } = makePush();
    const service = new InterviewFeedbackService(
      repository as unknown as InterviewFeedbackRepository,
      makeAgent(async () => feedbackResponse()),
      memory as unknown as MemoryRepository,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.markFailedFinal(INTERVIEW_ID, 'agent_unavailable');

    expect(failed).toEqual([]);
  });
});
