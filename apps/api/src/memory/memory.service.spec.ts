import { ApiException } from '../common/api-error.js';
import type { CoachingBrief, Fact } from '../db/schema.js';
import { MemoryService } from './memory.service.js';
import type { MemoryRepository } from './memory.repository.js';

function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: 'fact-1',
    user_id: 'user-1',
    text: 'Ana is planning a trip to Lisbon.',
    happens_on: null,
    status: 'pending',
    source_session_id: null,
    last_used_at: null,
    use_count: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBrief(overrides: Partial<CoachingBrief> = {}): CoachingBrief {
  return {
    user_id: 'user-1',
    text: 'Focus on past simple.',
    level_hint: 'B1',
    recurring_errors: [],
    source_session_id: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function createService(repositoryOverrides: Record<string, unknown> = {}) {
  const memoryRepository = {
    listActiveFacts: vi.fn().mockResolvedValue([]),
    updateFact: vi.fn(),
    deleteFact: vi.fn(),
    getBrief: vi.fn().mockResolvedValue(null),
    upsertBriefText: vi.fn(),
    purgeAll: vi.fn().mockResolvedValue(undefined),
    ...repositoryOverrides,
  };

  const service = new MemoryService(memoryRepository as unknown as MemoryRepository);
  return { service, memoryRepository };
}

describe('MemoryService.getMemory — agrupación pending/confirmed', () => {
  it('splits facts returned by the repository into pending and confirmed buckets', async () => {
    const facts = [
      makeFact({ id: 'p1', status: 'pending' }),
      makeFact({ id: 'c1', status: 'confirmed' }),
      makeFact({ id: 'p2', status: 'pending' }),
      makeFact({ id: 'c2', status: 'confirmed' }),
    ];
    const { service } = createService({
      listActiveFacts: vi.fn().mockResolvedValue(facts),
      getBrief: vi.fn().mockResolvedValue(null),
    });

    const result = await service.getMemory('user-1');

    expect(result.facts.pending.map((f) => f.id)).toEqual(['p1', 'p2']);
    expect(result.facts.confirmed.map((f) => f.id)).toEqual(['c1', 'c2']);
  });

  it('returns empty buckets when the user has no facts', async () => {
    const { service } = createService();
    const result = await service.getMemory('user-1');
    expect(result.facts).toEqual({ pending: [], confirmed: [] });
  });

  it('returns a non-null empty default brief when the user has no coaching_briefs row (PEND-40)', async () => {
    const { service } = createService({ getBrief: vi.fn().mockResolvedValue(null) });
    const result = await service.getMemory('user-1');
    expect(result.brief).toEqual({
      text: '',
      levelHint: null,
      recurringErrors: [],
      updatedAt: null,
    });
  });

  it('maps the brief row when it exists', async () => {
    const { service } = createService({
      getBrief: vi.fn().mockResolvedValue(makeBrief({ text: 'Keep it up.' })),
    });
    const result = await service.getMemory('user-1');
    expect(result.brief.text).toBe('Keep it up.');
  });
});

describe('MemoryService.patchFact', () => {
  it('rejects when neither status nor text is present -> 400 VALIDATION (PEND-41)', async () => {
    const { service, memoryRepository } = createService();

    await expect(service.patchFact('user-1', 'fact-1', undefined, undefined)).rejects.toMatchObject(
      { code: 'VALIDATION' },
    );
    expect(memoryRepository.updateFact).not.toHaveBeenCalled();
  });

  it('always calls the repository with the calling user id, never a bare id lookup', async () => {
    const { service, memoryRepository } = createService({
      updateFact: vi.fn().mockResolvedValue(makeFact({ status: 'confirmed' })),
    });

    await service.patchFact('user-1', 'fact-1', 'confirmed', undefined);

    expect(memoryRepository.updateFact).toHaveBeenCalledWith('user-1', 'fact-1', {
      status: 'confirmed',
    });
  });

  it('passes text-only patches through untouched (status stays untouched)', async () => {
    const { service, memoryRepository } = createService({
      updateFact: vi.fn().mockResolvedValue(makeFact({ text: 'New text' })),
    });

    await service.patchFact('user-1', 'fact-1', undefined, 'New text');

    expect(memoryRepository.updateFact).toHaveBeenCalledWith('user-1', 'fact-1', {
      text: 'New text',
    });
  });

  it('throws 403 FORBIDDEN when the repository finds nothing (missing fact or another user\'s fact, PEND-42)', async () => {
    const { service } = createService({ updateFact: vi.fn().mockResolvedValue(null) });

    try {
      await service.patchFact('user-B', 'fact-of-user-A', 'dismissed', undefined);
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('FORBIDDEN');
    }
  });
});

describe('MemoryService.deleteFact', () => {
  it('calls the repository with the calling user id', async () => {
    const { service, memoryRepository } = createService({
      deleteFact: vi.fn().mockResolvedValue(true),
    });

    await service.deleteFact('user-1', 'fact-1');

    expect(memoryRepository.deleteFact).toHaveBeenCalledWith('user-1', 'fact-1');
  });

  it('throws 403 FORBIDDEN when nothing was deleted (another user\'s fact, PEND-42)', async () => {
    const { service } = createService({ deleteFact: vi.fn().mockResolvedValue(false) });

    await expect(service.deleteFact('user-B', 'fact-of-user-A')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('MemoryService.putBrief', () => {
  it('delegates to the repository and maps the row back', async () => {
    const { service, memoryRepository } = createService({
      upsertBriefText: vi.fn().mockResolvedValue(makeBrief({ text: 'Updated brief.' })),
    });

    const result = await service.putBrief('user-1', 'Updated brief.');

    expect(memoryRepository.upsertBriefText).toHaveBeenCalledWith('user-1', 'Updated brief.');
    expect(result.text).toBe('Updated brief.');
  });
});

describe('MemoryService.deleteAll', () => {
  it('delegates to the repository purgeAll with the calling user id', async () => {
    const { service, memoryRepository } = createService();

    await service.deleteAll('user-1');

    expect(memoryRepository.purgeAll).toHaveBeenCalledWith('user-1');
  });
});
