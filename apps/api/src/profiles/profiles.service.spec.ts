import {
  PendingActionsService,
  WEEKLY_SUMMARY_NEEDS_CREDENTIAL,
} from './pending-actions.service.js';
import { ProfilesService } from './profiles.service.js';
import type { ProfilesRepository } from './profiles.repository.js';
import type { GroupsRepository } from '../groups/groups.repository.js';
import type { Profile } from '../db/schema.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'user-1',
    group_id: null,
    display_name: 'Usuario',
    level: 'A2',
    suggested_level: null,
    interests: [],
    timezone: 'America/Sao_Paulo',
    locale: 'es',
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    courtesy_session_used_at: null,
    plan: 'free',
    plan_expires_at: null,
    sessions_count: 0,
    avatar_url: null,
    onboarded_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const dto: UpdateProfileDto = Object.assign(
  Object.create(null) as UpdateProfileDto,
  {
    displayName: 'Ana Gómez',
    level: 'B1' as const,
    interests: ['travel', 'movies', 'food'],
    timezone: 'America/Sao_Paulo',
    locale: 'es' as const,
  },
);

function createService(
  profile: Profile,
  group: unknown = null,
  pendingActions: string[] = [],
  sessionsToday = 0,
) {
  const profilesRepository = {
    ensureProfile: vi.fn().mockResolvedValue(profile),
    update: vi.fn().mockImplementation(async (_userId: string, patch: Record<string, unknown>) => ({
      ...profile,
      ...patch,
    })),
    getModelPreference: vi.fn().mockResolvedValue(null),
    getActiveSessionId: vi.fn().mockResolvedValue(null),
    awardProfileCompleted: vi.fn().mockResolvedValue(20),
    purgeAppData: vi.fn().mockResolvedValue(undefined),
    refreshAvatar: vi.fn().mockResolvedValue(null),
  };

  const groupsRepository = {
    findById: vi.fn().mockResolvedValue(group),
  };

  const pendingActionsService = {
    listFor: vi.fn().mockResolvedValue(pendingActions),
  };

  const sessionsQuery = {
    countValidSessionsSince: vi.fn().mockResolvedValue(sessionsToday),
  };

  const service = new ProfilesService(
    profilesRepository as unknown as ProfilesRepository,
    groupsRepository as unknown as GroupsRepository,
    pendingActionsService as unknown as PendingActionsService,
    sessionsQuery as unknown as SessionsQueryRepository,
  );

  return {
    service,
    sessionsQuery,
    profilesRepository,
    groupsRepository,
    pendingActionsService,
  };
}

describe('ProfilesService.updateProfile — cálculo de onboarded_at', () => {
  it('sets onboarded_at when the profile is complete and the user already has a group', async () => {
    const profile = makeProfile({ group_id: 'group-1', onboarded_at: null });
    const { service, profilesRepository } = createService(profile);

    await service.updateProfile('user-1', dto);

    expect(profilesRepository.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onboarded_at: expect.any(String) }),
    );
  });

  it('does NOT set onboarded_at when the user has no group yet', async () => {
    const profile = makeProfile({ group_id: null, onboarded_at: null });
    const { service, profilesRepository } = createService(profile);

    await service.updateProfile('user-1', dto);

    const patch = profilesRepository.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('onboarded_at');
  });

  it('does not overwrite an existing onboarded_at (never "un-onboards")', async () => {
    const profile = makeProfile({ group_id: 'group-1', onboarded_at: '2026-08-15T00:00:00.000Z' });
    const { service, profilesRepository } = createService(profile);

    await service.updateProfile('user-1', dto);

    const patch = profilesRepository.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('onboarded_at');
  });

  it('calls ensureProfile before updating (lazy profile creation)', async () => {
    const profile = makeProfile();
    const { service, profilesRepository } = createService(profile);

    await service.updateProfile('user-1', dto);

    expect(profilesRepository.ensureProfile).toHaveBeenCalledWith('user-1');
  });
});

describe('ProfilesService.getMe', () => {
  it('reports onboarded: true only when onboarded_at is set', async () => {
    const profile = makeProfile({ onboarded_at: '2026-08-15T00:00:00.000Z' });
    const { service } = createService(profile);

    const me = await service.getMe('user-1');

    expect(me.onboarded).toBe(true);
  });

  it('completa la foto del proveedor vinculado si el perfil no la tiene', async () => {
    const { service, profilesRepository } = createService(makeProfile({ avatar_url: null }));
    profilesRepository.refreshAvatar.mockResolvedValue('https://lh3.googleusercontent.com/a/x');

    const me = await service.getMe('user-1');

    expect(profilesRepository.refreshAvatar).toHaveBeenCalledWith('user-1');
    expect(me.profile.avatarUrl).toBe('https://lh3.googleusercontent.com/a/x');
  });

  it('no consulta la foto de nuevo si el perfil ya la tiene', async () => {
    const { service, profilesRepository } = createService(
      makeProfile({ avatar_url: 'https://lh3.googleusercontent.com/a/y' }),
    );

    const me = await service.getMe('user-1');

    expect(profilesRepository.refreshAvatar).not.toHaveBeenCalled();
    expect(me.profile.avatarUrl).toBe('https://lh3.googleusercontent.com/a/y');
  });

  it('si refrescar la foto falla, GET /me responde igual', async () => {
    const { service, profilesRepository } = createService(makeProfile({ avatar_url: null }));
    profilesRepository.refreshAvatar.mockRejectedValue(new Error('rpc caída'));

    const me = await service.getMe('user-1');

    expect(me.profile.avatarUrl).toBeNull();
  });

  it('reports onboarded: false when onboarded_at is null', async () => {
    const profile = makeProfile({ onboarded_at: null });
    const { service } = createService(profile);

    const me = await service.getMe('user-1');

    expect(me.onboarded).toBe(false);
  });

  it('returns group: null when the profile has no group_id', async () => {
    const profile = makeProfile({ group_id: null });
    const { service, groupsRepository } = createService(profile, null);

    const me = await service.getMe('user-1');

    expect(me.group).toBeNull();
    expect(groupsRepository.findById).not.toHaveBeenCalled();
  });

  it('includes an empty pendingActions and the full interests catalog', async () => {
    const profile = makeProfile();
    const { service, pendingActionsService } = createService(profile);

    const me = await service.getMe('user-1');

    expect(me.pendingActions).toEqual([]);
    expect(pendingActionsService.listFor).toHaveBeenCalledWith('user-1');
    expect(me.interestsCatalog.length).toBeGreaterThan(0);
  });

  // `pendingActions` deja de ser siempre `[]` al fusionar PR-05
  // (docs/specs/pendientes/PR-02.md PEND-76).
  it('expone la acción pendiente que deja el job weekly-summary en Redis', async () => {
    const profile = makeProfile();
    const { service } = createService(profile, null, [WEEKLY_SUMMARY_NEEDS_CREDENTIAL]);

    const me = await service.getMe('user-1');

    expect(me.pendingActions).toEqual(['WEEKLY_SUMMARY_NEEDS_CREDENTIAL']);
  });
});

describe('ProfilesService.getMe · sessionsToday', () => {
  it('cuenta las sesiones válidas de hoy en la zona del usuario', async () => {
    const profile = makeProfile({ timezone: 'Asia/Tokyo' });
    const { service, sessionsQuery } = createService(profile, null, [], 2);

    const me = await service.getMe('user-1');

    expect(me.sessionsToday).toBe(2);

    // El corte es el comienzo del día **del usuario**: en Tokio, a las 02:00
    // UTC ya es por la tarde, así que `since` tiene que quedar por detrás.
    const since = new Date(
      (sessionsQuery.countValidSessionsSince.mock.calls[0] as [string, string])[1],
    );
    expect(since.getTime()).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - since.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('devuelve 0 cuando el usuario no cerró ninguna hoy', async () => {
    const { service } = createService(makeProfile(), null, [], 0);

    expect((await service.getMe('user-1')).sessionsToday).toBe(0);
  });
});

describe('ProfilesService.updateProfile · XP por perfil completado (MEJ-14)', () => {
  it('concede el XP la primera vez que el perfil queda completo', async () => {
    const profile = makeProfile({ group_id: 'group-1', onboarded_at: null, xp: 0 });
    const { service, profilesRepository } = createService(profile);

    const result = await service.updateProfile('user-1', {
      displayName: 'Ana',
      level: 'B1',
      interests: ['travel', 'movies', 'food'],
      timezone: 'America/Sao_Paulo',
      locale: 'es',
    });

    expect(profilesRepository.awardProfileCompleted).toHaveBeenCalledWith('user-1', 20);
    expect(result.xpAwarded).toBe(20);
    // El XP recién concedido viaja en la respuesta: la app no tiene que
    // recargar `/me` solo para ver su propia recompensa.
    expect(result.xp).toBe(20);
  });

  it('no lo pide si el perfil ya estaba onboarded', async () => {
    const profile = makeProfile({
      group_id: 'group-1',
      onboarded_at: '2026-09-01T10:00:00.000Z',
    });
    const { service, profilesRepository } = createService(profile);

    const result = await service.updateProfile('user-1', {
      displayName: 'Ana',
      level: 'B1',
      interests: ['travel', 'movies', 'food'],
      timezone: 'America/Sao_Paulo',
      locale: 'es',
    });

    expect(profilesRepository.awardProfileCompleted).not.toHaveBeenCalled();
    expect(result.xpAwarded).toBe(0);
  });

  it('no lo pide si todavía no hay grupo: el perfil no está completo', async () => {
    const profile = makeProfile({ group_id: null, onboarded_at: null });
    const { service, profilesRepository } = createService(profile);

    const result = await service.updateProfile('user-1', {
      displayName: 'Ana',
      level: 'B1',
      interests: ['travel', 'movies', 'food'],
      timezone: 'America/Sao_Paulo',
      locale: 'es',
    });

    expect(profilesRepository.awardProfileCompleted).not.toHaveBeenCalled();
    expect(result.xpAwarded).toBe(0);
  });

  it('si la base dice que ya estaba concedido, xpAwarded es 0', async () => {
    const profile = makeProfile({ group_id: 'group-1', onboarded_at: null, xp: 20 });
    const { service, profilesRepository } = createService(profile);
    profilesRepository.awardProfileCompleted.mockResolvedValue(0);

    const result = await service.updateProfile('user-1', {
      displayName: 'Ana',
      level: 'B1',
      interests: ['travel', 'movies', 'food'],
      timezone: 'America/Sao_Paulo',
      locale: 'es',
    });

    // La idempotencia la decide la base, no esta capa: aquí solo se refleja.
    expect(result.xpAwarded).toBe(0);
    expect(result.xp).toBe(20);
  });
});

describe('ProfilesService.getMe · plan', () => {
  it('free por defecto y sin `providers` en la respuesta', async () => {
    const { service } = createService(makeProfile());

    const me = await service.getMe('user-1');

    expect(me.plan).toBe('free');
    expect(me.planExpiresAt).toBeNull();
    expect(me).not.toHaveProperty('providers');
  });

  it('pro sin vencimiento', async () => {
    const { service } = createService(makeProfile({ plan: 'pro' }));

    const me = await service.getMe('user-1');

    expect(me.plan).toBe('pro');
    expect(me.planExpiresAt).toBeNull();
  });

  it('pro con vencimiento futuro devuelve la fecha', async () => {
    const expires = new Date(Date.now() + 86_400_000).toISOString();
    const { service } = createService(makeProfile({ plan: 'pro', plan_expires_at: expires }));

    const me = await service.getMe('user-1');

    expect(me.plan).toBe('pro');
    expect(me.planExpiresAt).toBe(expires);
  });

  it('pro vencido se informa como free', async () => {
    const { service } = createService(
      makeProfile({ plan: 'pro', plan_expires_at: '2026-01-01T00:00:00.000Z' }),
    );

    expect((await service.getMe('user-1')).plan).toBe('free');
  });
});
