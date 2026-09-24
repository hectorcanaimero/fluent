import type { ConfigService } from '@nestjs/config';

import { LlmUnavailableError, type LlmService } from '../../llm/llm.service.js';
import { CoachingBriefService } from './coaching-brief.service.js';
import type {
  BriefSessionRow,
  CoachingBriefRepository,
} from './coaching-brief.repository.js';
import type { BriefJobStatus, Level } from '../../db/schema.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
function makeConfig(promptVersion = 7): ConfigService<never, true> {
  return {
    get: (key: string) => (key === 'PROMPT_VERSION' ? promptVersion : undefined),
  } as unknown as ConfigService<never, true>;
}

interface RepoState {
  briefJobStatus: BriefJobStatus;
  profileLevel: Level;
  suggestedLevel: Level | null;
  historyLevelHints: (Level | null)[];
}

function makeRepository(state: RepoState) {
  const session: BriefSessionRow = {
    id: SESSION_ID,
    user_id: USER_ID,
    kind: 'free_topic',
    topic: 'weekend plans',
    get brief_job_status() {
      return state.briefJobStatus;
    },
  };

  return {
    loadSession: vi.fn(async () => session),
    markSessionRunning: vi.fn(async () => {
      state.briefJobStatus = 'running';
    }),
    markSessionFailed: vi.fn(async () => {
      state.briefJobStatus = 'failed';
    }),
    loadTurns: vi.fn(async () => [
      { role: 'user' as const, text: 'I go to the beach yesterday' },
      { role: 'tutor' as const, text: 'Nice! You mean "I went to the beach".' },
    ]),
    loadProfile: vi.fn(async () => ({
      level: state.profileLevel,
      locale: 'es' as const,
      suggested_level: state.suggestedLevel,
      plan: 'pro' as const,
      plan_expires_at: null,
    })),
    loadCurrentBriefText: vi.fn(async () => 'Work on past simple.'),
    loadKnownFacts: vi.fn(async () => ['The learner has a dog.']),
    loadModelPreference: vi.fn(async () => ({
      brief_provider: 'openrouter' as const,
      brief_model: 'anthropic/claude-3.5-sonnet',
    })),
    applyBrief: vi.fn(async () => {
      state.briefJobStatus = 'done';
      return { applied: true, facts_inserted: 1, facts_skipped: 0 };
    }),
    recentHistoryLevelHints: vi.fn(async (_userId: string, limit: number) =>
      state.historyLevelHints.slice(0, limit),
    ),
    updateSuggestedLevel: vi.fn(async (_userId: string, level: Level) => {
      state.suggestedLevel = level;
    }),
  };
}

function makeLlm(overrides?: Partial<Record<string, unknown>>): LlmService {
  return {
    complete: vi.fn(async () => ({
      data: {
        brief: 'Keep drilling past simple; the learner enjoys beach topics.',
        facts: [{ text: 'The learner went to the beach.', happens_on: null }],
        level_hint: 'B2' as const,
        recurring_errors: [{ category: 'past_simple' as const, example: 'I go yesterday' }],
      },
      modelUsed: 'anthropic/claude-3.5-sonnet',
      provider: 'openrouter' as const,
      usage: { tokensIn: 100, tokensOut: 50 },
      degraded: false,
      attempts: [],
    })),
    ...overrides,
  } as unknown as LlmService;
}

function baseState(): RepoState {
  return {
    briefJobStatus: 'pending',
    profileLevel: 'B1',
    suggestedLevel: null,
    historyLevelHints: ['B2', 'B2'],
  };
}

describe('CoachingBriefService (SPEC-05 §2)', () => {
  it('aplica el brief y sugiere nivel tras tres level_hint consecutivos', async () => {
    const state = baseState();
    const repository = makeRepository(state);
    const llm = makeLlm();
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      llm,
      makeConfig(),
    );

    const result = await service.run(SESSION_ID);

    expect(result).toMatchObject({
      status: 'applied',
      factsInserted: 1,
      suggestedLevel: 'B2',
    });
    expect(repository.markSessionRunning).toHaveBeenCalledOnce();
    expect(repository.applyBrief).toHaveBeenCalledOnce();
    expect(repository.updateSuggestedLevel).toHaveBeenCalledWith(USER_ID, 'B2');

    // El prompt recibe el brief anterior y los hechos conocidos, y la llamada
    // lleva la preferencia de modelo del rol `brief` y el plan efectivo del usuario.
    const request = (llm.complete as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(request.purpose).toBe('brief');
    expect(request.preference).toEqual({
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
    });
    expect(request.plan).toBe('pro');
    expect(request.promptVersion).toBe('7');
    expect(request.messages[1].content).toContain('Work on past simple.');
    expect(request.messages[1].content).toContain('The learner has a dog.');
  });

  it('es idempotente: la segunda ejecución no llama al LLM ni a apply_brief', async () => {
    const state = baseState();
    const repository = makeRepository(state);
    const llm = makeLlm();
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      llm,
      makeConfig(),
    );

    await service.run(SESSION_ID);
    const second = await service.run(SESSION_ID);

    expect(second).toEqual({ status: 'skipped', reason: 'already_done' });
    expect(llm.complete).toHaveBeenCalledOnce();
    expect(repository.applyBrief).toHaveBeenCalledOnce();
    expect(repository.markSessionRunning).toHaveBeenCalledOnce();
  });

  it('no sugiere nivel si la racha no llega a tres briefs', async () => {
    const state = { ...baseState(), historyLevelHints: ['B2' as Level] };
    const repository = makeRepository(state);
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      makeLlm(),
      makeConfig(),
    );

    const result = await service.run(SESSION_ID);

    expect(result.suggestedLevel).toBeNull();
    expect(repository.updateSuggestedLevel).not.toHaveBeenCalled();
  });

  it('sale sin tocar nada si la sesión no existe', async () => {
    const state = baseState();
    const repository = makeRepository(state);
    repository.loadSession = vi.fn(async () => null) as never;
    const llm = makeLlm();
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      llm,
      makeConfig(),
    );

    expect(await service.run(SESSION_ID)).toEqual({
      status: 'skipped',
      reason: 'session_not_found',
    });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('propaga LlmUnavailableError para que BullMQ reintente', async () => {
    const state = baseState();
    const repository = makeRepository(state);
    const llm = makeLlm({
      complete: vi.fn(async () => {
        throw new LlmUnavailableError([]);
      }),
    });
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      llm,
      makeConfig(),
    );

    await expect(service.run(SESSION_ID)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(repository.applyBrief).not.toHaveBeenCalled();
    // La sesión queda en `running`, no en `done`: el reintento la reprocesará.
    expect(state.briefJobStatus).toBe('running');
  });
});

describe('CoachingBriefService.markFailed (MAL-20)', () => {
  it('deja la sesión en `failed` en vez de `running` para siempre', async () => {
    const state = baseState();
    const repository = makeRepository(state);
    const service = new CoachingBriefService(
      repository as unknown as CoachingBriefRepository,
      makeLlm(),
      makeConfig(),
    );

    await service.markFailed(SESSION_ID);

    expect(repository.markSessionFailed).toHaveBeenCalledWith(SESSION_ID);
    expect(state.briefJobStatus).toBe('failed');
  });
});
