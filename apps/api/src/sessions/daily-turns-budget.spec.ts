import type { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { RedisService } from '../redis/redis.service.js';
import { DailyTurnsBudget } from './daily-turns-budget.js';
import { turnsDayKey, userDay } from './user-day.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TZ = 'Europe/Madrid';
// `now` fijo: sin él, un test que cruce la medianoche miraría otra clave.
const NOW = new Date('2026-03-10T12:00:00Z');

type FakeRedis = RedisService & { readonly counters: Map<string, number> };

function fakeRedis(options: { incrementFails?: boolean } = {}): FakeRedis {
  const counters = new Map<string, number>();
  return {
    counters,
    increment: async (key: string) => {
      // `null` simula Redis caído: el tope diario es fail-open (MAL-23).
      if (options.incrementFails) return null;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
  } as unknown as FakeRedis;
}

function fakeConfig(capFree: number, capPro: number): ConfigService<never, true> {
  const values: Record<string, number> = {
    TURNS_DAILY_CAP_FREE: capFree,
    TURNS_DAILY_CAP_PRO: capPro,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
}

describe('DailyTurnsBudget.consume', () => {
  it('deja pasar mientras no se llegue al tope', async () => {
    const redis = fakeRedis();
    const budget = new DailyTurnsBudget(redis, fakeConfig(3, 10));

    await budget.consume(USER_ID, 'free', TZ, NOW);

    const key = turnsDayKey(USER_ID, userDay(TZ, NOW));
    expect(redis.counters.get(key)).toBe(1);
  });

  it('al pasarse rechaza con 429 TURNS_DAILY_CAP y retryAfter', async () => {
    const redis = fakeRedis();
    const budget = new DailyTurnsBudget(redis, fakeConfig(1, 10));

    await budget.consume(USER_ID, 'free', TZ, NOW);
    const error = await budget.consume(USER_ID, 'free', TZ, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('TURNS_DAILY_CAP');
    expect((error as ApiException).getStatus()).toBe(429);
    const body = (error as ApiException).getApiBody();
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter as number).toBeGreaterThan(0);
    expect((error as ApiException).message).toContain('Pro');
  });

  it('con el tope a 0 no cuenta nada', async () => {
    const redis = fakeRedis();
    const budget = new DailyTurnsBudget(redis, fakeConfig(0, 10));

    await budget.consume(USER_ID, 'free', TZ, NOW);

    expect(redis.counters.size).toBe(0);
  });

  it('un plan Pro usa TURNS_DAILY_CAP_PRO y no menciona Pro en el mensaje', async () => {
    const redis = fakeRedis();
    const budget = new DailyTurnsBudget(redis, fakeConfig(1, 2));

    await budget.consume(USER_ID, 'pro', TZ, NOW);
    await budget.consume(USER_ID, 'pro', TZ, NOW);
    const error = await budget.consume(USER_ID, 'pro', TZ, NOW).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('TURNS_DAILY_CAP');
    expect((error as ApiException).message).not.toContain('Pro');
    const key = turnsDayKey(USER_ID, userDay(TZ, NOW));
    expect(redis.counters.get(key)).toBe(3);
  });

  it('con Redis caído deja pasar (fail-open)', async () => {
    const redis = fakeRedis({ incrementFails: true });
    const budget = new DailyTurnsBudget(redis, fakeConfig(1, 10));

    await budget.consume(USER_ID, 'free', TZ, NOW);
    await budget.consume(USER_ID, 'free', TZ, NOW);

    expect(redis.counters.size).toBe(0);
  });

  it('la clave del contador lleva el día de la zona recibida', async () => {
    const redis = fakeRedis();
    const budget = new DailyTurnsBudget(redis, fakeConfig(5, 10));

    await budget.consume(USER_ID, 'free', 'Asia/Tokyo', NOW);

    const key = [...redis.counters.keys()][0]!;
    expect(key).toBe(turnsDayKey(USER_ID, userDay('Asia/Tokyo', NOW)));
  });
});
