import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import { DEFAULT_AVG_TOKENS_IN, DEFAULT_AVG_TOKENS_OUT } from '../llm/catalog.service.js';
import { NINEROUTER_MODELS } from '../llm/ninerouter-models.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { ModelPreferencesRepository } from './model-preferences.repository.js';
import { ModelsService } from './models.service.js';
import type { SessionUsageRepository } from './session-usage.repository.js';

const ROUTER_JSON = JSON.stringify({ data: NINEROUTER_MODELS.map((m) => ({ id: m.id })) });

/** Doble de `RedisService`/`CacheStore` en memoria, sin Redis real (PEND-07). */
class InMemoryCache {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

function fakeFetch(body = ROUTER_JSON): typeof fetch {
  return (async () =>
    new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
}

interface Doubles {
  modelPreferences: { upsert: ReturnType<typeof vi.fn> };
  sessionUsage: { averageTokensForRecentSessions: ReturnType<typeof vi.fn> };
  profiles: { findByUserId: ReturnType<typeof vi.fn> };
}

function profileWithPlan(plan: 'free' | 'pro') {
  return { findByUserId: vi.fn().mockResolvedValue({ plan, plan_expires_at: null }) };
}

function makeService(overrides: Partial<Doubles> = {}, fetchImpl: typeof fetch = fakeFetch()) {
  const doubles: Doubles = {
    modelPreferences: {
      upsert: vi.fn().mockImplementation(async (userId: string, patch: Record<string, unknown>) => ({
        user_id: userId,
        chat_provider: patch.chat_provider,
        chat_model: patch.chat_model,
        brief_provider: patch.brief_provider,
        brief_model: patch.brief_model,
        updated_at: '2026-09-08T00:00:00.000Z',
      })),
    },
    sessionUsage: { averageTokensForRecentSessions: vi.fn().mockResolvedValue(null) },
    profiles: profileWithPlan('pro'),
    ...overrides,
  };

  const service = new ModelsService(
    doubles.modelPreferences as unknown as ModelPreferencesRepository,
    doubles.sessionUsage as unknown as SessionUsageRepository,
    doubles.profiles as unknown as ProfilesRepository,
    new InMemoryCache() as never,
    fetchImpl,
    {
      get: (key: string) => (key === 'NINEROUTER_URL' ? 'http://router.test/v1' : 'operator-key'),
    } as unknown as ConfigService<never, true>,
  );

  return { service, ...doubles };
}

describe('ModelsService.getCatalog (GET /models, SPEC-02 §4.2)', () => {
  it('groups the catalog under the 9router key with fluent-free in free', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');

    expect(Object.keys(catalog.providers)).toEqual(['9router']);
    expect(catalog.providers['9router'].free.map((m) => m.id)).toContain('fluent-free');
    expect(catalog.providers['9router'].premium.map((m) => m.id)).toContain('fluent-pro');
  });

  it('every element has exactly the {id, name, pricePerMillionUsd} shape', async () => {
    const { service } = makeService();

    const sample = (await service.getCatalog('user-1')).providers['9router'].premium[0];

    expect(Object.keys(sample!).sort()).toEqual(['id', 'name', 'pricePerMillionUsd']);
  });

  it('estimatePerSession has one entry per model in the catalog', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');

    expect(Object.keys(catalog.estimatePerSession).sort()).toEqual(NINEROUTER_MODELS.map((m) => m.id).sort());
  });

  it('uses the default averages (9000 in / 2500 out) when the user has no history', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');

    const pro = NINEROUTER_MODELS.find((m) => m.id === 'ds/deepseek-v4-flash')!;
    const expected =
      DEFAULT_AVG_TOKENS_IN * (pro.pricePerMillionIn / 1_000_000) +
      DEFAULT_AVG_TOKENS_OUT * (pro.pricePerMillionOut / 1_000_000);
    expect(catalog.estimatePerSession[pro.id]).toBeCloseTo(expected, 8);
  });

  it('uses the averages of the last 10 sessions when the user has history', async () => {
    const { service, sessionUsage } = makeService();
    sessionUsage.averageTokensForRecentSessions.mockResolvedValue({ avgTokensIn: 1000, avgTokensOut: 1000 });

    const catalog = await service.getCatalog('user-1');

    const pro = NINEROUTER_MODELS.find((m) => m.id === 'ds/deepseek-v4-flash')!;
    expect(catalog.estimatePerSession[pro.id]).toBeCloseTo(
      1000 * (pro.pricePerMillionIn / 1_000_000) + 1000 * (pro.pricePerMillionOut / 1_000_000),
      8,
    );
  });

  it("downloads the catalog with the operator's key", async () => {
    const calls: Array<Record<string, string> | undefined> = [];
    const spyFetch = (async (_url: unknown, init?: RequestInit) => {
      calls.push(init?.headers as Record<string, string> | undefined);
      return new Response(ROUTER_JSON, { status: 200 });
    }) as typeof fetch;

    await makeService({}, spyFetch).service.getCatalog('user-1');

    expect(calls[0]?.Authorization).toBe('Bearer operator-key');
  });

  it('turns a download failure with no cache into a controlled ApiException (LLM_UNAVAILABLE), not a raw 500', async () => {
    const failingFetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    await expect(makeService({}, failingFetch).service.getCatalog('user-1')).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(ApiException);
        expect((error as ApiException).code).toBe('LLM_UNAVAILABLE');
        expect((error as ApiException).getApiBody().statusCode).toBe(503);
        return true;
      },
    );
  });
});

describe('ModelsService.updatePreferences (PUT /me/models, SPEC-02 §4.2)', () => {
  const dto = {
    chatProvider: '9router' as const,
    chatModel: 'fluent-free',
    briefProvider: '9router' as const,
    briefModel: 'fluent-pro',
  };

  it('rejects with MODEL_NOT_AVAILABLE when the model is not in the catalog', async () => {
    const { service, modelPreferences } = makeService();

    await expect(
      service.updatePreferences('user-1', { ...dto, chatModel: 'not-a-real-model' }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('MODEL_NOT_AVAILABLE');
      expect((error as ApiException).message).toMatch(/no está en el catálogo/);
      return true;
    });
    expect(modelPreferences.upsert).not.toHaveBeenCalled();
  });

  it('rejects a model that 9router does not currently serve', async () => {
    const body = JSON.stringify({ data: [{ id: 'fluent-free' }] });
    const { service, modelPreferences } = makeService({}, fakeFetch(body));

    await expect(service.updatePreferences('user-1', dto)).rejects.toMatchObject({
      code: 'MODEL_NOT_AVAILABLE',
    });
    expect(modelPreferences.upsert).not.toHaveBeenCalled();
  });

  it('happy path: both roles valid -> upserts and returns the flat modelPreference', async () => {
    const { service, modelPreferences } = makeService();

    const result = await service.updatePreferences('user-1', dto);

    expect(modelPreferences.upsert).toHaveBeenCalledWith('user-1', {
      chat_provider: '9router',
      chat_model: 'fluent-free',
      brief_provider: '9router',
      brief_model: 'fluent-pro',
    });
    expect(result).toEqual({
      chatProvider: '9router',
      chatModel: 'fluent-free',
      briefProvider: '9router',
      briefModel: 'fluent-pro',
    });
  });

  it('rejects a paid model with PLAN_REQUIRED (403) when the user is on Free', async () => {
    const { service, modelPreferences } = makeService({ profiles: profileWithPlan('free') });

    await expect(service.updatePreferences('user-1', dto)).rejects.toSatisfy((error: unknown) => {
      expect((error as ApiException).code).toBe('PLAN_REQUIRED');
      expect((error as ApiException).getApiBody().statusCode).toBe(403);
      return true;
    });
    expect(modelPreferences.upsert).not.toHaveBeenCalled();
  });

  it('lets a Free user pick free models', async () => {
    const { service, modelPreferences } = makeService({ profiles: profileWithPlan('free') });

    await service.updatePreferences('user-1', { ...dto, briefModel: 'fluent-free' });

    expect(modelPreferences.upsert).toHaveBeenCalledOnce();
  });
});
