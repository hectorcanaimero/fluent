import { BOSS_TOPICS } from '../content/index.js';
import { BOSS_EVERY_N_SESSIONS } from '../config/product.js';
import { isoDateString } from './iso-week.js';
import {
  BossService,
  isBossDue,
  type BossRepository,
  type BossSkipStore,
} from './boss.service.js';

/**
 * Repositorio simulado en memoria, siguiendo el patrón de `fakeRepo()` en
 * progress.service.spec.ts / challenges.service.spec.ts: datos programables
 * más un registro de con qué argumentos se llamó cada método.
 */
function fakeRepo(usedIds: readonly string[] = []): BossRepository & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    getUsedBossTopicIds: async (userId) => {
      calls.push(userId);
      return new Set(usedIds);
    },
  };
}

/** Skip-store simulado en memoria: un mapa `userId:day -> rechazado`. */
function fakeSkipStore(skipped: readonly { userId: string; day: string }[] = []): BossSkipStore & {
  wasSkippedCalls: Array<{ userId: string; day: string }>;
  recordSkipCalls: Array<{ userId: string; day: string }>;
} {
  const set = new Set(skipped.map((s) => `${s.userId}:${s.day}`));
  const wasSkippedCalls: Array<{ userId: string; day: string }> = [];
  const recordSkipCalls: Array<{ userId: string; day: string }> = [];
  return {
    wasSkippedCalls,
    recordSkipCalls,
    wasSkippedToday: async (userId, day) => {
      wasSkippedCalls.push({ userId, day });
      return set.has(`${userId}:${day}`);
    },
    recordSkip: async (userId, day) => {
      recordSkipCalls.push({ userId, day });
      set.add(`${userId}:${day}`);
    },
  };
}

// Tema B1 real de BOSS_TOPICS (para no asumir el índice si el contenido cambia).
const B1_TOPIC = BOSS_TOPICS.find((t) => t.level_min === 'B1')!;

describe('isBossDue', () => {
  it(`sessionsCount=6 (sería la sesión número 7) → true (BOSS_EVERY_N_SESSIONS=${BOSS_EVERY_N_SESSIONS})`, () => {
    expect(isBossDue(6)).toBe(true);
  });

  it('sessionsCount=13 (sería la sesión número 14) → true', () => {
    expect(isBossDue(13)).toBe(true);
  });

  it.each([0, 1, 5, 7, 21])('sessionsCount=%d → false', (sessionsCount) => {
    expect(isBossDue(sessionsCount)).toBe(false);
  });
});

describe('BossService.isPending', () => {
  const now = new Date('2026-09-08T10:00:00.000Z'); // isoDateString -> '2026-09-08'
  const yesterday = '2026-09-07';

  it('debido (sessionsCount=6) y no rechazado hoy → true', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.isPending('user-1', { sessionsCount: 6, level: 'B1' }, now);

    expect(result).toBe(true);
  });

  it('debido y rechazado hoy (mismo día que `now`) → false', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore([{ userId: 'user-1', day: isoDateString(now) }]);
    const service = new BossService(repo, skipStore);

    const result = await service.isPending('user-1', { sessionsCount: 6, level: 'B1' }, now);

    expect(result).toBe(false);
  });

  it('debido y rechazado ayer (día distinto al de `now`) → true, y consulta con el día de `now`', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore([{ userId: 'user-1', day: yesterday }]);
    const service = new BossService(repo, skipStore);

    const result = await service.isPending('user-1', { sessionsCount: 6, level: 'B1' }, now);

    expect(result).toBe(true);
    expect(skipStore.wasSkippedCalls).toEqual([{ userId: 'user-1', day: isoDateString(now) }]);
  });

  it('no debido (sessionsCount no cumple la fórmula) → false sin consultar el skip-store', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.isPending('user-1', { sessionsCount: 5, level: 'B1' }, now);

    expect(result).toBe(false);
    expect(skipStore.wasSkippedCalls).toEqual([]);
  });
});

describe('BossService.pickTopic', () => {
  it('evita temas ya usados por el usuario', async () => {
    // Marca como usado el primer tema alcanzable (en orden de BOSS_TOPICS)
    // para un perfil B2 y verifica que el resultado no sea ese id.
    const firstReachable = BOSS_TOPICS.find(
      (t) => t.level_min === 'B1' || t.level_min === 'B2',
    )!;
    const repo = fakeRepo([firstReachable.id]);
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.pickTopic('user-1', 'B2');

    expect(result).not.toBeNull();
    expect(result!.id).not.toBe(firstReachable.id);
  });

  it('un perfil B1 nunca recibe un tema level_min=B2', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.pickTopic('user-1', 'B1');

    expect(result).not.toBeNull();
    expect(result!.level_min).toBe('B1');
  });

  it('un perfil B2 puede recibir tanto temas level_min=B1 como B2 (según orden de BOSS_TOPICS)', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    // Sin usados: debe devolver el primer tema alcanzable en el orden de
    // BOSS_TOPICS (que puede ser B1 o B2 según el contenido real).
    const result = await service.pickTopic('user-1', 'B2');
    const firstReachable = BOSS_TOPICS.find(
      (t) => t.level_min === 'B1' || t.level_min === 'B2',
    )!;
    expect(result).toEqual(firstReachable);

    // Si se marcan como usados todos los B1, debe poder devolver uno B2.
    const b1Ids = BOSS_TOPICS.filter((t) => t.level_min === 'B1').map((t) => t.id);
    const repo2 = fakeRepo(b1Ids);
    const service2 = new BossService(repo2, skipStore);
    const result2 = await service2.pickTopic('user-1', 'B2');
    expect(result2).not.toBeNull();
    expect(result2!.level_min).toBe('B2');
  });

  it('devuelve el tema B1 real cuando el perfil es B1 y no hay usados', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.pickTopic('user-1', 'B1');

    expect(result!.id).toBe(B1_TOPIC.id);
  });

  it('devuelve null cuando todos los temas alcanzables para el nivel ya están usados', async () => {
    const reachableIds = BOSS_TOPICS.filter((t) => t.level_min === 'B1').map((t) => t.id);
    const repo = fakeRepo(reachableIds);
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.pickTopic('user-1', 'B1');

    expect(result).toBeNull();
  });

  it('un perfil A2 nunca tiene candidatos (BOSS_TOPICS solo tiene B1/B2) → null', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);

    const result = await service.pickTopic('user-1', 'A2');

    expect(result).toBeNull();
  });
});

describe('BossService.recordSkip', () => {
  it('llama a skipStore.recordSkip con el userId y el día (isoDateString) de `now`', async () => {
    const repo = fakeRepo();
    const skipStore = fakeSkipStore();
    const service = new BossService(repo, skipStore);
    const now = new Date('2026-09-08T23:59:59.000Z');

    await service.recordSkip('user-1', now);

    expect(skipStore.recordSkipCalls).toEqual([{ userId: 'user-1', day: '2026-09-08' }]);
  });
});
