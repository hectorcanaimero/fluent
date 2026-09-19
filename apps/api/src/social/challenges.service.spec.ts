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

/**
 * Las reglas de SPEC-07 §7 (ventana de 7 días, cooldown de 14, una por
 * miembro, máximo 3, desempate) se prueban en
 * `src/game/challenges.service.spec.ts`, que es donde viven desde que se
 * fusionó PR-07 (PEND-71). Aquí se prueba lo que aporta este PR: el acceso al
 * grupo, el filtro de "sesión válida" del repositorio y el DTO.
 */
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

  it('maps candidate rows to the DTO, using the member display name', async () => {
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
          avatarUrl: null,
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

  // El filtro de "sesión válida" (SPEC-07 §2) lo aplica el repositorio que
  // este servicio le pasa a `src/game/`, no el servicio de reglas: se prueba
  // aquí. Antes vivía en `challenge-picker.spec.ts`, que se borró (PEND-71).
  it('descarta sesiones sin XP: no son válidas (SPEC-07 §2)', async () => {
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
        xp_earned: 0,
      },
    ];
    const { service } = createService({ members, candidateRows });

    const result = await service.listChallenges('me', undefined, NOW);

    expect(result).toEqual({ items: [] });
  });

  it('descarta sesiones sin ended_at', async () => {
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
        ended_at: null,
        xp_earned: 60,
      },
    ];
    const { service } = createService({ members, candidateRows });

    const result = await service.listChallenges('me', undefined, NOW);

    expect(result).toEqual({ items: [] });
  });

  it('no expone endedAt: el DTO tiene los 5 campos de SPEC-02 §4.5 más avatarUrl', async () => {
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

    expect(Object.keys(result.items[0]!).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'fromUserId',
      'kind',
      'sessionId',
      'topic',
    ]);
  });
});
