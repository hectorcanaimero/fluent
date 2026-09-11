import type { NewsItem, Profile } from '../db/schema.js';
import type { BossProfileInput } from '../game/boss.service.js';
import { BossService } from '../game/boss.service.js';
import type { SessionsRepository } from './sessions.repository.js';
import { SESSION_RANDOM } from './sessions.constants.js';
import { SuggestionsService } from './suggestions.service.js';
import type { SuggestionsRepository } from './suggestions.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: USER_ID,
    group_id: null,
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: ['technology'],
    timezone: 'Europe/Madrid',
    locale: 'es',
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    courtesy_session_used_at: null,
    sessions_count: 0,
    onboarded_at: '2026-09-01T10:00:00.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function newsItemFixture(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'news-1',
    source: 'BBC Technology',
    url: 'https://example.test/1',
    title: 'AI breakthrough announced',
    summary: 'Resumen',
    tags: ['tech'],
    published_at: '2026-09-08T00:00:00.000Z',
    day: '2026-09-08',
    ...overrides,
  };
}

function fakeSessionsRepository(profile: Profile | null): SessionsRepository {
  return { findProfile: async () => profile } as unknown as SessionsRepository;
}

function fakeSuggestionsRepository(options: {
  recentRoleplayTopics?: string[];
  news?: NewsItem[];
}): SuggestionsRepository {
  return {
    listRecentRoleplayTopics: async () => options.recentRoleplayTopics ?? [],
    listRecentNews: async () => options.news ?? [],
  } as unknown as SuggestionsRepository;
}

function fakeBossService(isPending: boolean): BossService {
  return {
    isPending: async (_userId: string, _profile: BossProfileInput) => isPending,
  } as unknown as BossService;
}

describe('SuggestionsService', () => {
  it('perfil sin onboarded_at → 409 NOT_ONBOARDED', async () => {
    const service = new SuggestionsService(
      fakeSessionsRepository(profileFixture({ onboarded_at: null })),
      fakeSuggestionsRepository({}),
      fakeBossService(false),
      () => 0,
    );

    await expect(service.getSuggestions(USER_ID)).rejects.toMatchObject({
      code: 'NOT_ONBOARDED',
    });
  });

  it('perfil inexistente → 409 NOT_ONBOARDED', async () => {
    const service = new SuggestionsService(
      fakeSessionsRepository(null),
      fakeSuggestionsRepository({}),
      fakeBossService(false),
      () => 0,
    );

    await expect(service.getSuggestions(USER_ID)).rejects.toMatchObject({
      code: 'NOT_ONBOARDED',
    });
  });

  it('devuelve 8 topics, hasta 4 roleplays, hasta 4 news y bossPending del BossService', async () => {
    const service = new SuggestionsService(
      fakeSessionsRepository(profileFixture()),
      fakeSuggestionsRepository({ news: [newsItemFixture()] }),
      fakeBossService(true),
      () => 0,
    );

    const result = await service.getSuggestions(USER_ID, new Date('2026-09-08T12:00:00.000Z'));

    expect(result.topics).toHaveLength(8);
    expect(result.roleplays.length).toBeLessThanOrEqual(4);
    expect(result.roleplays[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), title: expect.any(String) }),
    );
    expect(result.news.length).toBeGreaterThanOrEqual(1);
    expect(result.bossPending).toBe(true);
  });

  it('excluye de `roleplays` los títulos recientes que devuelve el repositorio', async () => {
    // Un roleplay real del catálogo (mock via listRecentRoleplayTopics con su title_es).
    const { ROLEPLAYS } = await import('../content/index.js');
    const recentTitle = ROLEPLAYS[0]!.title_es;

    const service = new SuggestionsService(
      fakeSessionsRepository(profileFixture()),
      fakeSuggestionsRepository({ recentRoleplayTopics: [recentTitle] }),
      fakeBossService(false),
      () => 0,
    );

    const result = await service.getSuggestions(USER_ID);

    // Si el catálogo tiene más alternativas alcanzables, el reciente no debería aparecer.
    const titles = result.roleplays.map((r) => r.title);
    if (ROLEPLAYS.filter((r) => r.level_min !== 'B2').length > 4) {
      expect(titles).not.toContain(recentTitle);
    }
  });

  it('`news` respeta los intereses del perfil (tags de INTERESTS, no los ids)', async () => {
    const matching = newsItemFixture({ id: 'match', tags: ['tech'] }); // 'tech' es tag de 'technology'
    const outside = newsItemFixture({ id: 'outside', tags: ['soccer'] });

    const service = new SuggestionsService(
      fakeSessionsRepository(profileFixture({ interests: ['technology'] })),
      fakeSuggestionsRepository({ news: [outside, matching] }),
      fakeBossService(false),
      () => 0,
    );

    const result = await service.getSuggestions(USER_ID);
    expect(result.news[0]!.id).toBe('match');
  });

  it('pide las noticias de los últimos SUGGESTIONS_NEWS_MAX_AGE_DAYS días', async () => {
    let requestedSinceDay: string | undefined;
    const repository = {
      listRecentRoleplayTopics: async () => [],
      listRecentNews: async (sinceDay: string) => {
        requestedSinceDay = sinceDay;
        return [];
      },
    } as unknown as SuggestionsRepository;

    const service = new SuggestionsService(
      fakeSessionsRepository(profileFixture()),
      repository,
      fakeBossService(false),
      () => 0,
    );

    await service.getSuggestions(USER_ID, new Date('2026-09-08T12:00:00.000Z'));
    expect(requestedSinceDay).toBe('2026-09-05');
  });
});

describe('SESSION_RANDOM token', () => {
  it('es un símbolo de inyección (no cambia por accidente)', () => {
    expect(typeof SESSION_RANDOM).toBe('symbol');
  });
});
