import { ApiException } from '../common/api-error.js';
import { I18nService } from '../i18n/i18n.service.js';
import { OwnerService } from '../common/owner.service.js';
import type { Group, Profile } from '../db/schema.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import { GroupsService, MAX_LIVE_INVITATIONS_PER_MEMBER } from './groups.service.js';
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
    is_default: false,
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
    createInvitation: vi
      .fn()
      .mockResolvedValue({ code: 'ABCDEFGH', expiresAt: '2026-09-25T10:00:00.000Z' }),
    countLiveInvitations: vi.fn().mockResolvedValue(0),
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

    expect(result.group).toEqual({ id: 'group-1', name: 'Los Pibes', groupStreak: 2, isDefault: false });
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

describe('GroupsService.createInvitation — invitar desde la app (MEJ-41)', () => {
  it('cualquier miembro del grupo genera un código, no solo el owner', async () => {
    const group = makeGroup({ owner_id: 'group-owner' });
    const profile = makeProfile({ user_id: 'user-1', group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);

    const result = await service.createInvitation('user-1');

    expect(result).toEqual({ code: 'ABCDEFGH', expiresAt: '2026-09-25T10:00:00.000Z' });
    expect(groupsRepository.createInvitation).toHaveBeenCalledWith(group.id, 'user-1');
  });

  it('cuenta las invitaciones vivas del propio miembro, no las del grupo', async () => {
    const group = makeGroup();
    const profile = makeProfile({ user_id: 'user-1', group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);

    await service.createInvitation('user-1');

    expect(groupsRepository.countLiveInvitations).toHaveBeenCalledWith(
      'user-1',
      MAX_LIVE_INVITATIONS_PER_MEMBER,
    );
  });

  it(`con ${MAX_LIVE_INVITATIONS_PER_MEMBER} vivas → 422 INVITATION_LIMIT_REACHED y no crea ninguna`, async () => {
    const group = makeGroup();
    const profile = makeProfile({ user_id: 'user-1', group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);
    groupsRepository.countLiveInvitations.mockResolvedValue(MAX_LIVE_INVITATIONS_PER_MEMBER);

    const error = await service.createInvitation('user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getApiBody()).toMatchObject({
      error: 'INVITATION_LIMIT_REACHED',
      statusCode: 422,
    });
    expect(groupsRepository.createInvitation).not.toHaveBeenCalled();
  });

  it('una por debajo del tope todavía pasa', async () => {
    const group = makeGroup();
    const profile = makeProfile({ user_id: 'user-1', group_id: group.id });
    const { service, groupsRepository } = createService(profile, group);
    groupsRepository.countLiveInvitations.mockResolvedValue(MAX_LIVE_INVITATIONS_PER_MEMBER - 1);

    await expect(service.createInvitation('user-1')).resolves.toMatchObject({
      code: 'ABCDEFGH',
    });
  });

  it('sin grupo → 422 GROUP_REQUIRED (no el 409 NOT_ONBOARDED de los demás)', async () => {
    const profile = makeProfile({ user_id: 'user-1', group_id: null });
    const { service, groupsRepository } = createService(profile, null);

    const error = await service.createInvitation('user-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getApiBody()).toMatchObject({
      error: 'GROUP_REQUIRED',
      statusCode: 422,
    });
    expect(groupsRepository.countLiveInvitations).not.toHaveBeenCalled();
  });

  it('con `group_id` colgando de un grupo borrado → también GROUP_REQUIRED', async () => {
    const profile = makeProfile({ user_id: 'user-1', group_id: 'group-fantasma' });
    const { service } = createService(profile, null);

    await expect(service.createInvitation('user-1')).rejects.toMatchObject({
      code: 'GROUP_REQUIRED',
    });
  });

  it('el mensaje sale en el idioma del perfil', async () => {
    const group = makeGroup();
    const profile = makeProfile({ user_id: 'user-1', group_id: group.id, locale: 'pt-BR' });
    const { service, groupsRepository } = createService(profile, group);
    groupsRepository.countLiveInvitations.mockResolvedValue(MAX_LIVE_INVITATIONS_PER_MEMBER);

    const error = (await service
      .createInvitation('user-1')
      .catch((e: unknown) => e)) as ApiException;

    expect(error.getApiBody().message).toContain('convites');
  });

  it('`POST /admin/invitations` sigue exigiendo owner y sin grupo sigue dando NOT_ONBOARDED', async () => {
    const profile = makeProfile({ user_id: 'user-1', group_id: null });
    const { service } = createService(profile, null);

    await expect(service.createInvitations('user-1', 1)).rejects.toMatchObject({
      code: 'NOT_ONBOARDED',
    });
  });
});
