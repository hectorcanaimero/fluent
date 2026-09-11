import { ApiException } from '../common/api-error.js';
import { I18nService } from '../i18n/i18n.service.js';
import { OwnerService } from '../common/owner.service.js';
import type { Group, Profile } from '../db/schema.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import { GroupsService } from './groups.service.js';
import type { GroupsRepository } from './groups.repository.js';

const OWNER_USER_ID = '9595625c-aea8-4120-accc-ed149d0a84c6';

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
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    courtesy_session_used_at: null,
    sessions_count: 0,
    onboarded_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Los Pibes',
    owner_id: 'group-owner',
    group_streak: 2,
    group_streak_day: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function createService(
  profile: Profile | null,
  group: Group | null,
  members: unknown[] = [],
) {
  const profilesRepository = {
    ensureProfile: vi.fn().mockResolvedValue(profile),
  };
  const groupsRepository = {
    findById: vi.fn().mockResolvedValue(group),
    listMembers: vi.fn().mockResolvedValue(members),
    redeemInvitation: vi.fn(),
    createInvitations: vi.fn().mockResolvedValue(['ABCDEFGH']),
  };

  // Mock de OwnerService que implementa la lógica de isOwner.
  const ownerService = {
    isOwner: vi.fn((userId: string, targetGroup: Group) => {
      return userId === targetGroup.owner_id || userId === OWNER_USER_ID;
    }),
    isSystemOwner: vi.fn((userId: string) => userId === OWNER_USER_ID),
  };

  const service = new GroupsService(
    profilesRepository as unknown as ProfilesRepository,
    groupsRepository as unknown as GroupsRepository,
    new I18nService(),
    ownerService as unknown as OwnerService,
  );

  return { service, profilesRepository, groupsRepository, ownerService };
}

describe('GroupsService.createInvitations — quién es "owner"', () => {
  it('allows the group.owner_id to create invitations', async () => {
    const group = makeGroup({ owner_id: 'group-owner' });
    const profile = makeProfile({ user_id: 'group-owner', group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);

    const result = await service.createInvitations('group-owner', 1);

    expect(result.codes).toEqual(['ABCDEFGH']);
    expect(groupsRepository.createInvitations).toHaveBeenCalledWith(group.id, 'group-owner', 1);
  });

  it('allows OWNER_USER_ID to create invitations even if not group.owner_id', async () => {
    const group = makeGroup({ owner_id: 'someone-else' });
    const profile = makeProfile({ user_id: OWNER_USER_ID, group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);

    const result = await service.createInvitations(OWNER_USER_ID, 2);

    expect(result.codes).toEqual(['ABCDEFGH']);
    expect(groupsRepository.createInvitations).toHaveBeenCalledWith(group.id, OWNER_USER_ID, 2);
  });

  it('rejects a member who is neither group.owner_id nor OWNER_USER_ID with 403 FORBIDDEN', async () => {
    const group = makeGroup({ owner_id: 'group-owner' });
    const profile = makeProfile({ user_id: 'plain-member', group_id: group.id });
    const { service } = createService(profile, group);

    await expect(service.createInvitations('plain-member', 1)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects with 409 NOT_ONBOARDED when the caller has no group yet', async () => {
    const profile = makeProfile({ group_id: null });
    const { service } = createService(profile, null);

    await expect(service.createInvitations('user-1', 1)).rejects.toMatchObject({
      code: 'NOT_ONBOARDED',
    });
  });
});

describe('GroupsService.getGroup', () => {
  it('returns 409 NOT_ONBOARDED when the user has no group', async () => {
    const profile = makeProfile({ group_id: null });
    const { service } = createService(profile, null);

    await expect(service.getGroup('user-1')).rejects.toMatchObject({ code: 'NOT_ONBOARDED' });
  });

  it('returns the group and mapped members when the user has a group', async () => {
    const group = makeGroup();
    const profile = makeProfile();
    const members = [
      {
        user_id: 'user-1',
        display_name: 'Ana',
        level: 'B1',
        xp: 10,
        streak: 1,
        last_session_day: null,
      },
    ];
    const { service } = createService(profile, group, members);

    const result = await service.getGroup('user-1');

    expect(result.group).toEqual({ id: 'group-1', name: 'Los Pibes', groupStreak: 2 });
    expect(result.members).toEqual([
      { userId: 'user-1', displayName: 'Ana', level: 'B1', xp: 10, streak: 1, lastSessionDay: null },
    ]);
  });
});

describe('GroupsService — reutiliza ApiException para errores de dominio', () => {
  it('propagates ApiException instances unchanged', async () => {
    const profile = makeProfile({ group_id: null });
    const { service } = createService(profile, null);

    try {
      await service.getGroup('user-1');
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
    }
  });
});
