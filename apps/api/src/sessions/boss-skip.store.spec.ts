import type { RedisService } from '../redis/redis.service.js';
import { bossSkipKey, RedisBossSkipStore } from './boss-skip.store.js';
import { BOSS_SKIP_TTL_SECONDS } from './sessions.constants.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DAY = '2026-09-08';

/** `RedisService` simulado en memoria, con la misma política de "nunca lanza". */
function fakeRedis(options: { down?: boolean } = {}) {
  const store = new Map<string, string>();
  const sets: Array<{ key: string; value: string; ttl: number }> = [];

  const service = {
    sets,
    store,
    get: async (key: string) => (options.down ? null : (store.get(key) ?? null)),
    set: async (key: string, value: string, ttlSeconds: number) => {
      sets.push({ key, value, ttl: ttlSeconds });
      if (!options.down) store.set(key, value);
    },
  };

  return service as unknown as RedisService & typeof service;
}

describe('bossSkipKey', () => {
  it('usa el formato `boss:skip:<userId>:<YYYY-MM-DD>`', () => {
    expect(bossSkipKey(USER_ID, DAY)).toBe(`boss:skip:${USER_ID}:${DAY}`);
  });
});

describe('RedisBossSkipStore', () => {
  it('sin marca previa, `wasSkippedToday` es false', async () => {
    const redis = fakeRedis();
    const store = new RedisBossSkipStore(redis);

    await expect(store.wasSkippedToday(USER_ID, DAY)).resolves.toBe(false);
  });

  it('`recordSkip` escribe la clave del día con TTL de 24 h', async () => {
    const redis = fakeRedis();
    const store = new RedisBossSkipStore(redis);

    await store.recordSkip(USER_ID, DAY);

    expect(redis.sets).toEqual([
      { key: `boss:skip:${USER_ID}:${DAY}`, value: '1', ttl: BOSS_SKIP_TTL_SECONDS },
    ]);
    expect(BOSS_SKIP_TTL_SECONDS).toBe(24 * 60 * 60);
  });

  it('tras `recordSkip`, `wasSkippedToday` es true ese día y false al siguiente', async () => {
    const redis = fakeRedis();
    const store = new RedisBossSkipStore(redis);

    await store.recordSkip(USER_ID, DAY);

    await expect(store.wasSkippedToday(USER_ID, DAY)).resolves.toBe(true);
    await expect(store.wasSkippedToday(USER_ID, '2026-09-09')).resolves.toBe(false);
  });

  it('la marca es por usuario', async () => {
    const redis = fakeRedis();
    const store = new RedisBossSkipStore(redis);

    await store.recordSkip(USER_ID, DAY);

    await expect(store.wasSkippedToday('otro-usuario', DAY)).resolves.toBe(false);
  });

  it('con Redis caído degrada a «no se rechazó» (el boss se sigue ofreciendo)', async () => {
    const redis = fakeRedis({ down: true });
    const store = new RedisBossSkipStore(redis);

    await store.recordSkip(USER_ID, DAY);

    await expect(store.wasSkippedToday(USER_ID, DAY)).resolves.toBe(false);
  });
});
