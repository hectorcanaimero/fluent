import { I18nService } from '../i18n/i18n.service.js';
import type { GroupsRepository } from '../groups/groups.repository.js';
import type { GroupAccessService } from './group-access.service.js';
import type { LeaderboardRepository } from './leaderboard.repository.js';
import { LeaderboardService } from './leaderboard.service.js';

const NOW = new Date('2026-09-09T12:00:00.000Z'); // Wednesday, week start 2026-09-07

function createService(params: {
  group?: { id: string; group_streak: number };
  entries?: unknown[];
  members?: unknown[];
  ownGroupError?: Error;
}) {
  const group = params.group ?? { id: 'group-1', group_streak: 3 };

  const groupAccess = {
    requireOwnGroup: params.ownGroupError
      ? vi.fn().mockRejectedValue(params.ownGroupError)
      : vi.fn().mockResolvedValue({ profile: { user_id: 'user-1' }, group, locale: 'es' }),
  };
  const groupsRepository = {
    listMembers: vi.fn().mockResolvedValue(params.members ?? []),
  };
  const leaderboardRepository = {
    weeklyLeaderboard: vi.fn().mockResolvedValue(params.entries ?? []),
  };

  const service = new LeaderboardService(
    groupAccess as unknown as GroupAccessService,
    groupsRepository as unknown as GroupsRepository,
    leaderboardRepository as unknown as LeaderboardRepository,
    new I18nService(),
  );

  return { service, groupAccess, groupsRepository, leaderboardRepository };
}

describe('LeaderboardService.getLeaderboard', () => {
  it('resolves weekStart to the Monday of the current week when no ?week= is given', async () => {
    const { service, leaderboardRepository } = createService({});

    await service.getLeaderboard('user-1', undefined, undefined, NOW);

    expect(leaderboardRepository.weeklyLeaderboard).toHaveBeenCalledWith('group-1', '2026-09-07');
  });

  it('normalizes a Sunday ?week= to the Monday before it', async () => {
    const { service, leaderboardRepository } = createService({});

    await service.getLeaderboard('user-1', '2023-01-01', undefined, NOW);

    expect(leaderboardRepository.weeklyLeaderboard).toHaveBeenCalledWith('group-1', '2022-12-26');
  });

  it('rejects a malformed ?week= with 400 VALIDATION', async () => {
    const { service } = createService({});

    await expect(service.getLeaderboard('user-1', 'not-a-date', undefined, NOW)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('maps RPC rows and joins per-member streak from listMembers, preserving RPC order', async () => {
    const entries = [
      { user_id: 'u2', display_name: 'Bea', xp: 100, sessions: 3, rank: 1 },
      { user_id: 'u1', display_name: 'Ana', xp: 90, sessions: 4, rank: 2 },
    ];
    const members = [
      { user_id: 'u1', display_name: 'Ana', level: 'B1', xp: 900, streak: 5, last_session_day: null },
      { user_id: 'u2', display_name: 'Bea', level: 'B2', xp: 1200, streak: 2, last_session_day: null },
    ];
    const { service } = createService({ entries, members, group: { id: 'group-1', group_streak: 7 } });

    const result = await service.getLeaderboard('user-1', undefined, undefined, NOW);

    expect(result).toEqual({
      weekStart: '2026-09-07',
      rows: [
        { userId: 'u2', displayName: 'Bea', xpWeek: 100, sessionsWeek: 3, streak: 2 },
        { userId: 'u1', displayName: 'Ana', xpWeek: 90, sessionsWeek: 4, streak: 5 },
      ],
      groupStreak: 7,
    });
  });

  it('defaults streak to 0 if a member is missing from listMembers (defensive)', async () => {
    const entries = [{ user_id: 'u3', display_name: 'Cato', xp: 10, sessions: 1, rank: 1 }];
    const { service } = createService({ entries, members: [] });

    const result = await service.getLeaderboard('user-1', undefined, undefined, NOW);

    expect(result.rows).toEqual([
      { userId: 'u3', displayName: 'Cato', xpWeek: 10, sessionsWeek: 1, streak: 0 },
    ]);
  });

  it('propagates 409 NOT_ONBOARDED from GroupAccessService for a user without a group', async () => {
    const { ApiException } = await import('../common/api-error.js');
    const { service } = createService({ ownGroupError: ApiException.of('NOT_ONBOARDED', 'x') as unknown as Error });

    await expect(service.getLeaderboard('user-1', undefined, undefined, NOW)).rejects.toMatchObject({
      code: 'NOT_ONBOARDED',
    });
  });
});
