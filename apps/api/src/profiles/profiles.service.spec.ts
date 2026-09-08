import {
  PendingActionsService,
  WEEKLY_SUMMARY_NEEDS_CREDENTIAL,
} from './pending-actions.service.js';
import { ProfilesService } from './profiles.service.js';
import type { CredentialsRepository } from '../credentials/credentials.repository.js';
import type { ProfilesRepository } from './profiles.repository.js';
import type { GroupsRepository } from '../groups/groups.repository.js';
import type { Profile } from '../db/schema.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

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
    sessions_count: 0,
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
) {
  const profilesRepository = {
    ensureProfile: vi.fn().mockResolvedValue(profile),
    update: vi.fn().mockImplementation(async (_userId: string, patch: Record<string, unknown>) => ({
      ...profile,
      ...patch,
    })),
    getModelPreference: vi.fn().mockResolvedValue(null),
    getActiveSessionId: vi.fn().mockResolvedValue(null),
    purgeAppData: vi.fn().mockResolvedValue(undefined),
  };

  const groupsRepository = {
    findById: vi.fn().mockResolvedValue(group),
  };

  // `provider_credentials` la lee `CredentialsRepository` desde PR-02/T4
  // (docs/specs/pendientes/PR-02.md PEND-15).
  const credentialsRepository = {
    listStatuses: vi.fn().mockResolvedValue([
      { provider: 'openrouter', status: 'not_connected', connectedAt: null },
      { provider: 'gemini', status: 'not_connected', connectedAt: null },
    ]),
  };

  const pendingActionsService = {
    listFor: vi.fn().mockResolvedValue(pendingActions),
  };

  const service = new ProfilesService(
    profilesRepository as unknown as ProfilesRepository,
    groupsRepository as unknown as GroupsRepository,
    credentialsRepository as unknown as CredentialsRepository,
    pendingActionsService as unknown as PendingActionsService,
  );

  return {
    service,
    profilesRepository,
    groupsRepository,
    credentialsRepository,
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
