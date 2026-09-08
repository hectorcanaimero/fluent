import type { CoachingBrief, Fact } from '../db/schema.js';
import { toCoachingBriefDto, toMemoryFactDto } from './memory.mapper.js';

function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: 'fact-1',
    user_id: 'user-1',
    text: 'Ana is planning a trip to Lisbon next month.',
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
    text: 'Focus on past simple and article usage.',
    level_hint: 'B1',
    recurring_errors: [],
    source_session_id: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toMemoryFactDto', () => {
  it('maps snake_case columns to the camelCase contract, including source_session_id -> sourceSession', () => {
    const dto = toMemoryFactDto(
      makeFact({
        id: 'fact-42',
        text: 'Ana has a job interview on Monday.',
        status: 'confirmed',
        happens_on: '2026-09-14',
        source_session_id: 'session-7',
        last_used_at: '2026-09-01T10:00:00.000Z',
      }),
    );

    expect(dto).toEqual({
      id: 'fact-42',
      text: 'Ana has a job interview on Monday.',
      status: 'confirmed',
      happensOn: '2026-09-14',
      sourceSession: 'session-7',
      lastUsedAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('does not leak columns absent from the app contract (use_count, created_at, updated_at, user_id)', () => {
    const dto = toMemoryFactDto(makeFact()) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('use_count');
    expect(dto).not.toHaveProperty('useCount');
    expect(dto).not.toHaveProperty('created_at');
    expect(dto).not.toHaveProperty('updated_at');
    expect(dto).not.toHaveProperty('user_id');
  });

  it('passes through null happensOn, sourceSession and lastUsedAt', () => {
    const dto = toMemoryFactDto(makeFact());
    expect(dto.happensOn).toBeNull();
    expect(dto.sourceSession).toBeNull();
    expect(dto.lastUsedAt).toBeNull();
  });
});

describe('toCoachingBriefDto', () => {
  it('returns a non-null empty default brief when there is no row (PEND-40)', () => {
    expect(toCoachingBriefDto(null)).toEqual({
      text: '',
      levelHint: null,
      recurringErrors: [],
      updatedAt: null,
    });
  });

  it('maps snake_case columns to the camelCase contract', () => {
    const dto = toCoachingBriefDto(
      makeBrief({
        text: 'Keep practicing past simple.',
        level_hint: 'B1',
        recurring_errors: [{ category: 'past_simple', example: 'go -> went' }],
        updated_at: '2026-09-05T12:00:00.000Z',
      }),
    );

    expect(dto).toEqual({
      text: 'Keep practicing past simple.',
      levelHint: 'B1',
      recurringErrors: [{ category: 'past_simple', example: 'go -> went' }],
      updatedAt: '2026-09-05T12:00:00.000Z',
    });
  });

  it('defaults a missing recurring_errors.example to an empty string (PEND-46), never null/undefined', () => {
    const dto = toCoachingBriefDto(
      makeBrief({ recurring_errors: [{ category: 'articles' } as never] }),
    );

    expect(dto.recurringErrors).toEqual([{ category: 'articles', example: '' }]);
  });

  it('passes through a null levelHint', () => {
    const dto = toCoachingBriefDto(makeBrief({ level_hint: null }));
    expect(dto.levelHint).toBeNull();
  });
});
