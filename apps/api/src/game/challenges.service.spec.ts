import {
  ChallengesService,
  type ChallengeCandidateSession,
  type ChallengesRepository,
} from './challenges.service.js';

/**
 * Repositorio simulado en memoria, siguiendo el patrón de `fakeRepo()` en
 * progress.service.spec.ts: datos programables más un registro de con qué
 * argumentos se llamó cada método, para poder verificar el `sinceIso` exacto
 * que calcula `ChallengesService`.
 */
function fakeRepo(options: {
  sessions?: ChallengeCandidateSession[];
  recentTopics?: Set<string>;
}): ChallengesRepository & {
  calls: {
    listLatestSessionsByGroupMember: Array<{ userId: string; sinceIso: string }>;
    recentTopics: Array<{ userId: string; sinceIso: string }>;
  };
} {
  const calls = {
    listLatestSessionsByGroupMember: [] as Array<{ userId: string; sinceIso: string }>,
    recentTopics: [] as Array<{ userId: string; sinceIso: string }>,
  };

  return {
    calls,
    listLatestSessionsByGroupMember: async (userId, sinceIso) => {
      calls.listLatestSessionsByGroupMember.push({ userId, sinceIso });
      // Simula que el repositorio real ya filtra por `ended_at >= sinceIso`.
      const since = new Date(sinceIso).getTime();
      return (options.sessions ?? []).filter((s) => new Date(s.endedAt).getTime() >= since);
    },
    recentTopics: async (userId, sinceIso) => {
      calls.recentTopics.push({ userId, sinceIso });
      return options.recentTopics ?? new Set<string>();
    },
  };
}

function session(overrides: Partial<ChallengeCandidateSession> = {}): ChallengeCandidateSession {
  return {
    sessionId: 'session-1',
    userId: 'member-1',
    displayName: 'Miembro 1',
    kind: 'free_topic',
    topic: 'travel',
    endedAt: '2026-09-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('ChallengesService.listFor', () => {
  const now = new Date('2026-09-09T12:00:00.000Z'); // miércoles

  it('pide las sesiones candidatas desde 7 días antes de `now`', async () => {
    const repo = fakeRepo({});
    const service = new ChallengesService(repo);

    await service.listFor('user-1', now);

    const expectedSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(repo.calls.listLatestSessionsByGroupMember).toEqual([
      { userId: 'user-1', sinceIso: expectedSince },
    ]);
  });

  it('pide los topics propios desde 14 días antes de `now`', async () => {
    const repo = fakeRepo({});
    const service = new ChallengesService(repo);

    await service.listFor('user-1', now);

    const expectedSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(repo.calls.recentTopics).toEqual([{ userId: 'user-1', sinceIso: expectedSince }]);
  });

  it('devuelve un candidato por cada miembro con sesión válida en los últimos 7 días', async () => {
    const sessions = [
      session({ userId: 'member-1', topic: 'travel', endedAt: '2026-09-08T10:00:00.000Z' }),
      session({ userId: 'member-2', topic: 'food', endedAt: '2026-09-07T10:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.fromUserId).sort()).toEqual(['member-1', 'member-2']);
  });

  it('un miembro sin sesión válida en los últimos 7 días no aparece', async () => {
    const sessions = [
      // fuera de la ventana de 7 días (now = 2026-09-09T12:00:00.000Z)
      session({ userId: 'member-1', topic: 'travel', endedAt: '2026-08-01T10:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toEqual([]);
  });

  it('descarta un candidato cuyo topic el usuario practicó en los últimos 14 días', async () => {
    const sessions = [session({ userId: 'member-1', topic: 'travel' })];
    const repo = fakeRepo({ sessions, recentTopics: new Set(['travel']) });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toEqual([]);
  });

  it('la comparación de topic es exacta (no descarta topics distintos)', async () => {
    const sessions = [session({ userId: 'member-1', topic: 'Travel' })];
    const repo = fakeRepo({ sessions, recentTopics: new Set(['travel']) });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(1);
    expect(result[0]!.topic).toBe('Travel');
  });

  it('un miembro con sesión válida cuyo único topic coincide con uno reciente propio no aporta candidato', async () => {
    const sessions = [
      session({ userId: 'member-1', topic: 'travel', endedAt: '2026-09-08T10:00:00.000Z' }),
      session({ userId: 'member-2', topic: 'food', endedAt: '2026-09-08T09:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions, recentTopics: new Set(['travel']) });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(1);
    expect(result[0]!.fromUserId).toBe('member-2');
  });

  it('nunca hay dos candidatos del mismo miembro, aunque el repositorio devuelva varias filas', async () => {
    const sessions = [
      session({ userId: 'member-1', topic: 'travel', endedAt: '2026-09-06T10:00:00.000Z' }),
      session({ userId: 'member-1', topic: 'food', endedAt: '2026-09-08T10:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(1);
    // Se queda con la sesión más reciente (2026-09-08), no con la de 2026-09-06.
    expect(result[0]).toEqual({
      fromUserId: 'member-1',
      displayName: 'Miembro 1',
      kind: 'free_topic',
      topic: 'food',
      sessionId: 'session-1',
      endedAt: '2026-09-08T10:00:00.000Z',
    });
  });

  it('filtra defensivamente sesiones cuyo userId coincide con el propio usuario', async () => {
    const sessions = [
      session({ userId: 'user-1', topic: 'travel', endedAt: '2026-09-08T10:00:00.000Z' }),
      session({ userId: 'member-2', topic: 'food', endedAt: '2026-09-08T09:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(1);
    expect(result[0]!.fromUserId).toBe('member-2');
  });

  it('máximo 3 resultados aunque haya más miembros con candidato válido, ordenados por endedAt desc', async () => {
    const sessions = [
      session({ userId: 'member-1', topic: 'travel', endedAt: '2026-09-05T10:00:00.000Z' }),
      session({ userId: 'member-2', topic: 'food', endedAt: '2026-09-08T10:00:00.000Z' }),
      session({ userId: 'member-3', topic: 'music', endedAt: '2026-09-07T10:00:00.000Z' }),
      session({ userId: 'member-4', topic: 'sports', endedAt: '2026-09-06T10:00:00.000Z' }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.fromUserId)).toEqual(['member-2', 'member-3', 'member-4']);
  });

  it('devuelve los campos de la sesión candidata tal cual, incluidos sessionId y displayName', async () => {
    const sessions = [
      session({
        sessionId: 'session-42',
        userId: 'member-1',
        displayName: 'Bea',
        kind: 'roleplay',
        topic: 'job interview',
        endedAt: '2026-09-08T10:00:00.000Z',
      }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result).toEqual([
      {
        fromUserId: 'member-1',
        displayName: 'Bea',
        kind: 'roleplay',
        topic: 'job interview',
        sessionId: 'session-42',
        endedAt: '2026-09-08T10:00:00.000Z',
      },
    ]);
  });

  // Desempate determinista añadido al fusionar PR-02 (PEND-71); antes dos
  // candidatos con el mismo `endedAt` quedaban en un orden arbitrario.
  it('a igualdad de endedAt, ordena por fromUserId ascendente', async () => {
    const endedAt = '2026-09-08T10:00:00.000Z';
    const sessions = [
      session({ userId: 'member-c', topic: 'music', endedAt }),
      session({ userId: 'member-a', topic: 'food', endedAt }),
      session({ userId: 'member-b', topic: 'sports', endedAt }),
    ];
    const repo = fakeRepo({ sessions });
    const service = new ChallengesService(repo);

    const result = await service.listFor('user-1', now);

    expect(result.map((c) => c.fromUserId)).toEqual(['member-a', 'member-b', 'member-c']);
  });
});
