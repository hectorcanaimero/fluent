import type { GroupsRepository } from '../groups/groups.repository.js';
import type { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { ChallengesService } from './challenges.service.js';
import type { GroupAccessService } from './group-access.service.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function createService(params: {
  members?: unknown[];
  candidateRows?: unknown[];
  practicedTopics?: Set<string>;
}) {
  const groupAccess = {
    requireOwnGroup: vi
      .fn()
      .mockResolvedValue({ profile: { user_id: 'me' }, group: { id: 'group-1' }, locale: 'es' }),
  };
  const groupsRepository = {
    listMembers: vi.fn().mockResolvedValue(params.members ?? []),
  };
  const sessionsQuery = {
    listCandidateSessionsForMembers: vi.fn().mockResolvedValue(params.candidateRows ?? []),
    listTopicsSince: vi.fn().mockResolvedValue(params.practicedTopics ?? new Set()),
  };

  const service = new ChallengesService(
    groupAccess as unknown as GroupAccessService,
    groupsRepository as unknown as GroupsRepository,
    sessionsQuery as unknown as SessionsQueryRepository,
  );

  return { service, groupAccess, groupsRepository, sessionsQuery };
}

describe('ChallengesService.listChallenges', () => {
  it('returns an empty list when the user has no other group members', async () => {
    const { service } = createService({ members: [{ user_id: 'me', display_name: 'Me' }] });

    const result = await service.listChallenges('me', undefined, NOW);

    expect(result).toEqual({ items: [] });
  });

  it('excludes the requesting user from the member list passed to the queries', async () => {
    const members = [
      { user_id: 'me', display_name: 'Me' },
      { user_id: 'friend-1', display_name: 'Friend' },
    ];
    const { service, sessionsQuery } = createService({ members });

    await service.listChallenges('me', undefined, NOW);

    expect(sessionsQuery.listCandidateSessionsForMembers).toHaveBeenCalledWith(
      ['friend-1'],
      expect.any(String),
    );
  });

  it('maps candidate rows through pickChallenges, using the member display name', async () => {
    const members = [
      { user_id: 'me', display_name: 'Me' },
      { user_id: 'friend-1', display_name: 'Beto' },
    ];
    const candidateRows = [
      {
        id: 'session-1',
        user_id: 'friend-1',
        topic: 'economy',
        kind: 'free_topic',
        ended_at: NOW.toISOString(),
        xp_earned: 60,
      },
    ];
    const { service } = createService({ members, candidateRows });

    const result = await service.listChallenges('me', undefined, NOW);

    expect(result).toEqual({
      items: [
        {
          fromUserId: 'friend-1',
          displayName: 'Beto',
          topic: 'economy',
          kind: 'free_topic',
          sessionId: 'session-1',
        },
      ],
    });
  });

  it('excludes candidates whose topic the requesting user already practiced in 14 days', async () => {
    const members = [
      { user_id: 'me', display_name: 'Me' },
      { user_id: 'friend-1', display_name: 'Beto' },
    ];
    const candidateRows = [
      {
        id: 'session-1',
        user_id: 'friend-1',
        topic: 'economy',
        kind: 'free_topic',
        ended_at: NOW.toISOString(),
        xp_earned: 60,
      },
    ];
    const { service } = createService({
      members,
      candidateRows,
      practicedTopics: new Set(['economy']),
    });

    const result = await service.listChallenges('me', undefined, NOW);

    expect(result).toEqual({ items: [] });
  });
});
