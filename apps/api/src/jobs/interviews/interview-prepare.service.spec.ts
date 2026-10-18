import type { ConfigService } from '@nestjs/config';

import {
  AgentInvalidResponseError,
  AgentUnavailableError,
  type InterviewAgentClient,
} from '../../interviews/interview-agent.client.js';
import type { PrepareResponse } from '../../interviews/interviews.types.js';
import type { PushService } from '../../push/push.service.js';
import { classifyPrepareError, InterviewPrepareService } from './interview-prepare.service.js';
import { ProfileMissingError } from './interview-prepare.repository.js';
import type {
  InterviewPrepareRepository,
  InterviewPrepareRow,
  MarkReadyInput,
  RecordPrepareUsageInput,
} from './interview-prepare.repository.js';

const INTERVIEW_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const PARENT_RUBRIC = [{ id: 'p1', name: 'APIs', expectedLevel: 'senior' as const, weight: 1 }];

function makeConfig(promptVersion = 3): ConfigService<never, true> {
  return {
    get: (key: string) => (key === 'PROMPT_VERSION' ? promptVersion : undefined),
  } as unknown as ConfigService<never, true>;
}

interface RepoState {
  status: InterviewPrepareRow['status'];
  parentInterviewId?: string;
}

function makeRepository(state: RepoState) {
  const interview = {
    id: INTERVIEW_ID,
    user_id: USER_ID,
    parent_interview_id: state.parentInterviewId ?? null,
    type: 'technical' as const,
    offer_text: 'We are hiring a backend engineer.',
    offer_url: null,
    offer_hash: 'hash-1',
    created_at: '2026-10-17T23:59:00.000Z',
    get status() {
      return state.status;
    },
  };

  const prepSteps: string[] = [];
  const ready: MarkReadyInput[] = [];
  const failed: string[] = [];
  const refunded: string[] = [];
  const usage: RecordPrepareUsageInput[] = [];
  const insertedQuestions: { userId: string; offerHash: string; area: string; questions: readonly string[] }[] = [];

  const locks = new Map<string, string>();
  const repository = {
    acquirePrepareLock: vi.fn(async (id: string, owner: string) => {
      const holder = locks.get(id);
      if (holder !== undefined && holder !== owner) return false;
      locks.set(id, owner);
      return true;
    }),
    releasePrepareLock: vi.fn(async (id: string, owner: string) => {
      if (locks.get(id) === owner) locks.delete(id);
    }),
    loadInterview: vi.fn(async () => (interview as unknown as InterviewPrepareRow)),
    loadLearnerLevel: vi.fn(async () => 'B1' as const),
    loadPreviousQuestions: vi.fn(async () => ['Old question?']),
    loadParentRubric: vi.fn(async () => PARENT_RUBRIC),
    setPrepStep: vi.fn(async (_id: string, step: string) => {
      prepSteps.push(step);
    }),
    markReady: vi.fn(async (_id: string, input: MarkReadyInput) => {
      ready.push(input);
      state.status = 'ready';
    }),
    markPrepFailed: vi.fn(async (_id: string, errorCode: string) => {
      failed.push(errorCode);
      state.status = 'prep_failed';
    }),
    insertQuestionsAsked: vi.fn(
      async (userId: string, offerHash: string, area: string, questions: readonly string[]) => {
        insertedQuestions.push({ userId, offerHash, area, questions });
      },
    ),
    recordPrepareUsage: vi.fn(async (input: RecordPrepareUsageInput) => {
      usage.push(input);
    }),
    refundDailyCap: vi.fn(async (userId: string, _createdAt: string) => {
      refunded.push(userId);
    }),
  };

  return { repository, prepSteps, ready, failed, refunded, usage, insertedQuestions };
}

function makePush() {
  const ready: unknown[] = [];
  const failed: unknown[] = [];
  const push = {
    notifyInterviewReady: vi.fn(async (...args: unknown[]) => {
      ready.push(args);
    }),
    notifyInterviewPrepFailed: vi.fn(async (...args: unknown[]) => {
      failed.push(args);
    }),
  };
  return { push, ready, failed };
}

/** Plan válido `technical` (0 behavioral), 4 competencias, 8 preguntas. */
function okResponse(): PrepareResponse {
  return {
    status: 'ok',
    type: 'technical',
    company: { name: 'Acme' },
    role: 'Backend engineer',
    area: 'engineering',
    seniority: 'semi_senior',
    stack: ['node'],
    rubric: [
      { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c2', name: 'Testing', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c3', name: 'Databases', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c4', name: 'System design', expectedLevel: 'semi_senior', weight: 1 },
    ],
    questions: Array.from({ length: 8 }, (_, i) => ({
      idx: i + 1,
      competencyId: `c${(i % 4) + 1}`,
      kind: 'technical' as const,
      text: `Question ${i + 1}`,
    })),
    research: { found: true, notes: 'ok' },
    usage: { model: 'fluent-pro', inputTokens: 500, outputTokens: 300, searchCalls: 1 },
  };
}

function makeAgent(resolveWith: () => Promise<PrepareResponse>): InterviewAgentClient {
  return { prepare: vi.fn(resolveWith) } as unknown as InterviewAgentClient;
}

describe('InterviewPrepareService.run', () => {
  it('éxito: guarda la ficha y el plan, inserta preguntas, registra uso y avisa listo', async () => {
    const { repository, prepSteps, ready, usage, insertedQuestions, refunded } = makeRepository({
      status: 'preparing',
    });
    const { push, ready: pushReady } = makePush();
    const agent = makeAgent(async () => okResponse());
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'ready' });
    expect(prepSteps).toEqual(['researching']);
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ role: 'Backend engineer', area: 'engineering' });
    expect(insertedQuestions).toHaveLength(1);
    expect(insertedQuestions[0]).toMatchObject({ userId: USER_ID, offerHash: 'hash-1', area: 'engineering' });
    expect(insertedQuestions[0]!.questions).toHaveLength(8);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      userId: USER_ID,
      purpose: 'interview_prepare',
      model: 'fluent-pro',
      tokensIn: 500,
      tokensOut: 300,
      attempt: 1,
      promptVersion: 3,
    });
    expect(pushReady).toHaveLength(1);
    expect(refunded).toEqual([]);
  });

  it('re-entrevista: manda la rúbrica de la padre como fixedRubric aunque el job no la traiga (retry)', async () => {
    const parentId = '33333333-3333-4333-8333-333333333333';
    const { repository } = makeRepository({ status: 'preparing', parentInterviewId: parentId });
    const { push } = makePush();
    const agent = makeAgent(async () => okResponse());
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.run(INTERVIEW_ID, 1, `${INTERVIEW_ID}-retry-1`);

    expect(repository.loadParentRubric).toHaveBeenCalledWith(parentId);
    expect(agent.prepare).toHaveBeenCalledWith(expect.objectContaining({ fixedRubric: PARENT_RUBRIC }));
  });

  it('sin padre no busca rúbrica ni manda fixedRubric', async () => {
    const { repository } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    const agent = makeAgent(async () => okResponse());
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(repository.loadParentRubric).not.toHaveBeenCalled();
    expect(vi.mocked(agent.prepare).mock.calls[0]![0]).not.toHaveProperty('fixedRubric');
  });

  it('offer_unreadable: prep_failed con el motivo, devuelve el tope y avisa el fallo sin llamar al LLM de uso', async () => {
    const { repository, failed, refunded, usage } = makeRepository({ status: 'preparing' });
    const { push, failed: pushFailed } = makePush();
    const agent = makeAgent(async () => ({ status: 'offer_unreadable', reason: 'empty' }));
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'offer_unreadable', errorCode: 'empty' });
    expect(failed).toEqual(['empty']);
    expect(refunded).toEqual([USER_ID]);
    expect(repository.refundDailyCap).toHaveBeenCalledWith(USER_ID, '2026-10-17T23:59:00.000Z');
    expect(pushFailed).toHaveLength(1);
    expect(usage).toEqual([]);
  });

  it('no procesa una entrevista que ya no está preparing (idempotencia)', async () => {
    const { repository } = makeRepository({ status: 'ready' });
    const { push } = makePush();
    const agent = makeAgent(async () => okResponse());
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    const result = await service.run(INTERVIEW_ID, 1, 'job-1');

    expect(result).toEqual({ status: 'skipped', reason: 'not_preparing' });
    expect(agent.prepare).not.toHaveBeenCalled();
  });

  it('respuesta inválida del agente: se propaga sin tocar el estado (lo reintenta BullMQ)', async () => {
    const { repository, failed, ready } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    const agent = makeAgent(async () => {
      throw new AgentInvalidResponseError('faltan preguntas');
    });
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toBeInstanceOf(AgentInvalidResponseError);
    expect(failed).toEqual([]);
    expect(ready).toEqual([]);
    expect(push.notifyInterviewPrepFailed).not.toHaveBeenCalled();
  });

  it('agente caído: se propaga sin tocar el estado (lo reintenta BullMQ)', async () => {
    const { repository, failed } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    const agent = makeAgent(async () => {
      throw new AgentUnavailableError('timeout');
    });
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toBeInstanceOf(AgentUnavailableError);
    expect(failed).toEqual([]);
    expect(push.notifyInterviewPrepFailed).not.toHaveBeenCalled();
  });
});

describe('InterviewPrepareService.run · idempotencia', () => {
  it('un reintento tras guardar el plan (markReady) no vuelve a llamar al agente', async () => {
    const { repository, usage, insertedQuestions } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    // El primer intento muere justo después de `markReady` (p. ej. el worker cae).
    push.notifyInterviewReady.mockRejectedValueOnce(new Error('worker caído'));
    const agent = makeAgent(async () => okResponse());
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toThrow('worker caído');
    const retry = await service.run(INTERVIEW_ID, 2, 'job-1');

    expect(retry).toEqual({ status: 'skipped', reason: 'not_preparing' });
    expect(agent.prepare).toHaveBeenCalledTimes(1);
    expect(usage).toHaveLength(1);
    expect(insertedQuestions).toHaveLength(1);
  });

  it('dos jobs concurrentes de la misma entrevista: solo uno llama al agente', async () => {
    const { repository } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const agent = makeAgent(async () => {
      await gate;
      return okResponse();
    });
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      agent,
      push as unknown as PushService,
      makeConfig(),
    );

    const first = service.run(INTERVIEW_ID, 1, 'job-1');
    const second = await service.run(INTERVIEW_ID, 1, 'job-2');
    release();

    expect(second).toEqual({ status: 'skipped', reason: 'locked' });
    expect(await first).toEqual({ status: 'ready' });
    expect(agent.prepare).toHaveBeenCalledTimes(1);
    expect(repository.releasePrepareLock).toHaveBeenCalledWith(INTERVIEW_ID, 'job-1');
  });

  it('suelta el candado aunque el agente falle', async () => {
    const { repository } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      makeAgent(async () => {
        throw new AgentUnavailableError('timeout');
      }),
      push as unknown as PushService,
      makeConfig(),
    );

    await expect(service.run(INTERVIEW_ID, 1, 'job-1')).rejects.toBeInstanceOf(AgentUnavailableError);
    expect(repository.releasePrepareLock).toHaveBeenCalledWith(INTERVIEW_ID, 'job-1');
  });
});

describe('classifyPrepareError', () => {
  it.each([
    [new AgentUnavailableError('x'), 'agent_unavailable', true],
    [new AgentInvalidResponseError('x'), 'agent_invalid_response', false],
    [new ProfileMissingError('x'), 'profile_missing', false],
    [new Error('InsForge caído'), 'internal', true],
    [undefined, 'internal', true],
  ])('%s -> %s (reintentable: %s)', (error, code, retryable) => {
    expect(classifyPrepareError(error)).toEqual({ code, retryable });
  });

  it('mira la causa (el Processor envuelve en UnrecoverableError)', () => {
    const wrapped = new Error('envoltorio', { cause: new ProfileMissingError('sin perfil') });
    expect(classifyPrepareError(wrapped).code).toBe('profile_missing');
  });
});

describe('InterviewPrepareService.markFailedFinal', () => {
  it('tras agotar los reintentos: prep_failed, devuelve el tope y avisa, sin tocar una entrevista ya resuelta', async () => {
    const { repository, failed, refunded } = makeRepository({ status: 'preparing' });
    const { push, failed: pushFailed } = makePush();
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      makeAgent(async () => okResponse()),
      push as unknown as PushService,
      makeConfig(),
    );

    await service.markFailedFinal(INTERVIEW_ID, 'agent_unavailable');

    expect(failed).toEqual(['agent_unavailable']);
    expect(refunded).toEqual([USER_ID]);
    expect(pushFailed).toHaveLength(1);
  });

  it('guarda el error_code real que le pasan', async () => {
    const { repository, failed } = makeRepository({ status: 'preparing' });
    const { push } = makePush();
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      makeAgent(async () => okResponse()),
      push as unknown as PushService,
      makeConfig(),
    );

    await service.markFailedFinal(INTERVIEW_ID, 'profile_missing');

    expect(failed).toEqual(['profile_missing']);
  });

  it('no hace nada si la entrevista ya no está preparing', async () => {
    const { repository, failed, refunded } = makeRepository({ status: 'ready' });
    const { push } = makePush();
    const service = new InterviewPrepareService(
      repository as unknown as InterviewPrepareRepository,
      makeAgent(async () => okResponse()),
      push as unknown as PushService,
      makeConfig(),
    );

    await service.markFailedFinal(INTERVIEW_ID, 'agent_unavailable');

    expect(failed).toEqual([]);
    expect(refunded).toEqual([]);
    expect(push.notifyInterviewPrepFailed).not.toHaveBeenCalled();
  });
});
