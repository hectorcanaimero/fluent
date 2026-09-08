import type { Profile } from '../db/schema.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import type { CorrectionsRepository } from './corrections.repository.js';
import { ProgressService } from './progress.service.js';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'user-1',
    group_id: 'group-1',
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: [],
    timezone: 'America/Sao_Paulo',
    locale: 'es',
    xp: 1600,
    streak: 4,
    longest_streak: 10,
    last_session_day: '2026-09-08',
    grace_used_week: null,
    sessions_count: 12,
    onboarded_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProgressService.getProgress', () => {
  const now = new Date('2026-09-09T12:00:00.000Z'); // Wednesday, week start 2026-09-07

  function createService(profile: Profile, sessionsThisWeek: number, correctionsRows: unknown[]) {
    const profilesRepository = {
      ensureProfile: vi.fn().mockResolvedValue(profile),
    };
    const sessionsQuery = {
      countValidSessionsSince: vi.fn().mockResolvedValue(sessionsThisWeek),
    };
    const correctionsRepository = {
      listRecentForTrend: vi.fn().mockResolvedValue(correctionsRows),
    };

    const service = new ProgressService(
      profilesRepository as unknown as ProfilesRepository,
      sessionsQuery as unknown as SessionsQueryRepository,
      correctionsRepository as unknown as CorrectionsRepository,
    );

    return { service, profilesRepository, sessionsQuery, correctionsRepository };
  }

  it('maps xp/streak/level from the profile and passes through sessionsThisWeek/correctionsTrend', async () => {
    const profile = makeProfile({ xp: 1600, streak: 4, longest_streak: 10 });
    const correctionsRows = [{ category: 'articles', created_at: now.toISOString() }];
    const { service, sessionsQuery, correctionsRepository } = createService(profile, 2, correctionsRows);

    const result = await service.getProgress('user-1', now);

    expect(result.xp).toBe(1600);
    expect(result.streak).toBe(4);
    expect(result.longestStreak).toBe(10);
    expect(result.level).toEqual({ name: 'Storyteller', min: 1500, next: 3500 });
    expect(result.sessionsThisWeek).toBe(2);
    expect(result.correctionsTrend).toEqual([{ category: 'articles', count30d: 1, count7d: 1 }]);

    // sessionsThisWeek se cuenta desde el lunes 00:00 UTC de la semana en curso.
    expect(sessionsQuery.countValidSessionsSince).toHaveBeenCalledWith(
      'user-1',
      '2026-09-07T00:00:00.000Z',
    );
    expect(correctionsRepository.listRecentForTrend).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );
  });

  it('a user with no data yet gets a well-formed empty response', async () => {
    const profile = makeProfile({ xp: 0, streak: 0, longest_streak: 0 });
    const { service } = createService(profile, 0, []);

    const result = await service.getProgress('user-1', now);

    expect(result).toEqual({
      xp: 0,
      level: { name: 'Newcomer', min: 0, next: 500 },
      streak: 0,
      longestStreak: 0,
      sessionsThisWeek: 0,
      correctionsTrend: [],
    });
  });
});
