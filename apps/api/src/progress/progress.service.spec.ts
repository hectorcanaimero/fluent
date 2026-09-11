import type { Profile } from '../db/schema.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import type { CorrectionsRepository } from './corrections.repository.js';
import { InsforgeProgressRepository } from './progress.repository.js';
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
    courtesy_session_used_at: null,
    sessions_count: 12,
    onboarded_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * `ProgressService` es un adaptador: la lógica se prueba en
 * `src/game/progress.service.spec.ts` y el mapeo en `progress.mapper.spec.ts`.
 * Lo que se comprueba aquí es el cableado extremo a extremo del endpoint: que
 * el repositorio traduce bien las filas de InsForge y que la respuesta tiene
 * la forma de SPEC-02 §4.5.
 */
describe('ProgressService.getProgress (adaptador de src/game)', () => {
  const now = new Date('2026-09-09T12:00:00.000Z'); // miércoles; lunes = 2026-09-07

  function createService(
    profile: Profile,
    sessionsThisWeek: number,
    correctionsRows: unknown[],
  ) {
    const profilesRepository = { ensureProfile: vi.fn().mockResolvedValue(profile) };
    const sessionsQuery = {
      countValidSessionsSince: vi.fn().mockResolvedValue(sessionsThisWeek),
    };
    const correctionsRepository = {
      listRecentForTrend: vi.fn().mockResolvedValue(correctionsRows),
    };

    const service = new ProgressService(
      new InsforgeProgressRepository(
        profilesRepository as unknown as ProfilesRepository,
        sessionsQuery as unknown as SessionsQueryRepository,
        correctionsRepository as unknown as CorrectionsRepository,
      ),
    );

    return { service, profilesRepository, sessionsQuery, correctionsRepository };
  }

  it('mapea el perfil y las correcciones al DTO de la app', async () => {
    const profile = makeProfile({ xp: 1600, streak: 4, longest_streak: 10 });
    const correctionsRows = [{ category: 'articles', created_at: now.toISOString() }];
    const { service, sessionsQuery, correctionsRepository } = createService(
      profile,
      2,
      correctionsRows,
    );

    const result = await service.getProgress('user-1', now);

    expect(result).toEqual({
      xp: 1600,
      level: { name: 'Storyteller', min: 1500, next: 3500 },
      streak: 4,
      longestStreak: 10,
      sessionsThisWeek: 2,
      correctionsTrend: [{ category: 'articles', count30d: 1, count7d: 1 }],
      grace: 'available',
    });

    // sessionsThisWeek se cuenta desde el lunes 00:00 UTC de la semana en curso.
    expect(sessionsQuery.countValidSessionsSince).toHaveBeenCalledWith(
      'user-1',
      '2026-09-07T00:00:00.000Z',
    );
    // La tendencia arranca 30 días antes de `now`.
    expect(correctionsRepository.listRecentForTrend).toHaveBeenCalledWith(
      'user-1',
      '2026-08-10T12:00:00.000Z',
    );
  });

  it('un usuario sin datos recibe una respuesta bien formada', async () => {
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
      grace: 'available',
    });
  });

  it('devuelve grace: used si el comodín de esta semana ya se gastó (MAL-27)', async () => {
    // `now` es 2026-09-11; el lunes de su semana ISO es el 2026-09-07.
    const profile = makeProfile({ grace_used_week: '2026-09-07' });
    const { service } = createService(profile, 0, []);

    expect((await service.getProgress('user-1', now)).grace).toBe('used');
  });

  it('el comodín de una semana anterior no cuenta como usado (MAL-27)', async () => {
    const profile = makeProfile({ grace_used_week: '2026-08-31' });
    const { service } = createService(profile, 0, []);

    expect((await service.getProgress('user-1', now)).grace).toBe('available');
  });
});
