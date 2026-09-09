import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiException } from '../common/api-error.js';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { ProviderCredential } from '../db/schema.js';
import { DEFAULT_AVG_TOKENS_IN, DEFAULT_AVG_TOKENS_OUT } from '../llm/catalog.service.js';
import type { ModelPreferencesRepository } from './model-preferences.repository.js';
import { ModelsService } from './models.service.js';
import type { SessionUsageRepository } from './session-usage.repository.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../fixtures/llm/openrouter-models.json', import.meta.url),
);
const FIXTURE_JSON = readFileSync(FIXTURE_PATH, 'utf-8');

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

function fakeFetch(body = FIXTURE_JSON): typeof fetch {
  return (async () =>
    new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
}

function makeActiveCredential(overrides: Partial<ProviderCredential> = {}): ProviderCredential {
  return {
    id: 'cred-1',
    user_id: 'user-1',
    provider: 'openrouter',
    key_ciphertext: '\\x00',
    key_iv: '\\x00',
    key_tag: '\\x00',
    status: 'active',
    last_error: null,
    connected_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

interface Doubles {
  credentialsService: {
    find: ReturnType<typeof vi.fn>;
    getActiveApiKey: ReturnType<typeof vi.fn>;
  };
  modelPreferences: { upsert: ReturnType<typeof vi.fn> };
  sessionUsage: { averageTokensForRecentSessions: ReturnType<typeof vi.fn> };
}

function makeService(overrides: Partial<Doubles> = {}, fetchImpl: typeof fetch = fakeFetch()) {
  const doubles: Doubles = {
    credentialsService: {
      find: vi.fn().mockResolvedValue(null),
      getActiveApiKey: vi.fn().mockResolvedValue(null),
    },
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
    ...overrides,
  };

  const service = new ModelsService(
    doubles.credentialsService as unknown as CredentialsService,
    doubles.modelPreferences as unknown as ModelPreferencesRepository,
    doubles.sessionUsage as unknown as SessionUsageRepository,
    new InMemoryCache() as never,
    fetchImpl,
  );

  return { service, ...doubles };
}

describe('ModelsService.getCatalog (GET /models, SPEC-02 §4.2)', () => {
  it('groups the catalog under the two provider keys and the three tiers', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');

    expect(Object.keys(catalog.providers).sort()).toEqual(['gemini', 'openrouter']);
    // Flash y Flash-Lite tienen free tier en Google AI Studio (RF-2.8); Pro es premium.
    expect(catalog.providers.gemini.free.length).toBe(2);
    expect(
      catalog.providers.gemini.budget.length + catalog.providers.gemini.premium.length,
    ).toBe(1);
    expect(catalog.providers.openrouter.free.length).toBeGreaterThan(0);
  });

  it('every element has exactly the {id, name, pricePerMillionUsd} shape', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');
    const sample = catalog.providers.openrouter.premium[0];

    expect(sample).toBeDefined();
    expect(Object.keys(sample!).sort()).toEqual(['id', 'name', 'pricePerMillionUsd']);
  });

  it('estimatePerSession has one entry per model in the catalog', async () => {
    const { service } = makeService();

    const catalog = await service.getCatalog('user-1');
    const allIds = [
      ...catalog.providers.openrouter.free,
      ...catalog.providers.openrouter.budget,
      ...catalog.providers.openrouter.premium,
      ...catalog.providers.gemini.free,
      ...catalog.providers.gemini.budget,
      ...catalog.providers.gemini.premium,
    ].map((m) => m.id);

    expect(Object.keys(catalog.estimatePerSession).sort()).toEqual(allIds.sort());
  });

  it('uses the default averages (9000 in / 2500 out) when the user has no history', async () => {
    const { service, sessionUsage } = makeService();
    sessionUsage.averageTokensForRecentSessions.mockResolvedValue(null);

    const catalog = await service.getCatalog('user-1');
    const sonnet = catalog.estimatePerSession['anthropic/claude-sonnet-4.5']!;

    // pricePerMillionIn=3, pricePerMillionOut=15 (ver catalog.service.spec.ts)
    const expected = DEFAULT_AVG_TOKENS_IN * (3 / 1_000_000) + DEFAULT_AVG_TOKENS_OUT * (15 / 1_000_000);
    expect(sonnet).toBeCloseTo(expected, 8);
  });

  it('uses the averages of the last 10 sessions when the user has history', async () => {
    const { service, sessionUsage } = makeService();
    sessionUsage.averageTokensForRecentSessions.mockResolvedValue({
      avgTokensIn: 1000,
      avgTokensOut: 1000,
    });

    const catalog = await service.getCatalog('user-1');
    const sonnet = catalog.estimatePerSession['anthropic/claude-sonnet-4.5']!;

    expect(sonnet).toBeCloseTo(1000 * (3 / 1_000_000) + 1000 * (15 / 1_000_000), 8);
  });

  it('downloads the catalog with the user\'s OpenRouter key when they have one', async () => {
    const calls: Array<Record<string, string> | undefined> = [];
    const spyFetch = (async (_url: unknown, init?: RequestInit) => {
      calls.push(init?.headers as Record<string, string> | undefined);
      return new Response(FIXTURE_JSON, { status: 200 });
    }) as typeof fetch;

    const { service, credentialsService } = makeService({}, spyFetch);
    credentialsService.getActiveApiKey.mockResolvedValue('sk-or-v1-the-users-key');

    await service.getCatalog('user-1');

    expect(calls[0]?.Authorization).toBe('Bearer sk-or-v1-the-users-key');
  });

  it('downloads the catalog without Authorization when the user has no OpenRouter key', async () => {
    const calls: Array<Record<string, string> | undefined> = [];
    const spyFetch = (async (_url: unknown, init?: RequestInit) => {
      calls.push(init?.headers as Record<string, string> | undefined);
      return new Response(FIXTURE_JSON, { status: 200 });
    }) as typeof fetch;

    const { service } = makeService({}, spyFetch);

    await service.getCatalog('user-1');

    expect(calls[0]?.Authorization).toBeUndefined();
  });

  it('turns a download failure with no cache into a controlled ApiException (LLM_UNAVAILABLE), not a raw 500', async () => {
    const failingFetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    const { service } = makeService({}, failingFetch);

    await expect(service.getCatalog('user-1')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('LLM_UNAVAILABLE');
      expect((error as ApiException).getApiBody().statusCode).toBe(503);
      return true;
    });
  });
});

describe('ModelsService.updatePreferences (PUT /me/models, SPEC-02 §4.2)', () => {
  const dto = {
    chatProvider: 'gemini' as const,
    chatModel: 'gemini-2.5-flash',
    briefProvider: 'openrouter' as const,
    briefModel: 'anthropic/claude-sonnet-4.5',
  };

  it('rejects with MODEL_NOT_AVAILABLE when the user has no active credential for the chosen provider', async () => {
    const { service, credentialsService, modelPreferences } = makeService();
    credentialsService.find.mockResolvedValue(null); // sin Gemini

    await expect(service.updatePreferences('user-1', dto)).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('MODEL_NOT_AVAILABLE');
      expect((error as ApiException).message).toMatch(/credencial activa/);
      return true;
    });
    expect(modelPreferences.upsert).not.toHaveBeenCalled();
  });

  it('rejects with MODEL_NOT_AVAILABLE (different message) when the model is not in the provider catalog', async () => {
    const { service, credentialsService, modelPreferences } = makeService();
    credentialsService.find.mockResolvedValue(makeActiveCredential({ provider: 'gemini' }));

    await expect(
      service.updatePreferences('user-1', { ...dto, chatModel: 'not-a-real-gemini-model' }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('MODEL_NOT_AVAILABLE');
      expect((error as ApiException).message).toMatch(/no está en el catálogo/);
      return true;
    });
    expect(modelPreferences.upsert).not.toHaveBeenCalled();
  });

  it('happy path: both roles valid -> upserts and returns the flat modelPreference', async () => {
    const { service, credentialsService, modelPreferences } = makeService();
    credentialsService.find.mockImplementation(
      async (_userId: string, provider: string) => makeActiveCredential({ provider: provider as never }),
    );

    const result = await service.updatePreferences('user-1', dto);

    expect(modelPreferences.upsert).toHaveBeenCalledWith('user-1', {
      chat_provider: 'gemini',
      chat_model: 'gemini-2.5-flash',
      brief_provider: 'openrouter',
      brief_model: 'anthropic/claude-sonnet-4.5',
    });
    expect(result).toEqual({
      chatProvider: 'gemini',
      chatModel: 'gemini-2.5-flash',
      briefProvider: 'openrouter',
      briefModel: 'anthropic/claude-sonnet-4.5',
    });
  });

  it('checks credential existence before catalog membership for each role independently', async () => {
    const { service, credentialsService } = makeService();
    // Chat (gemini) tiene credencial, brief (openrouter) no.
    credentialsService.find.mockImplementation(async (_userId: string, provider: string) =>
      provider === 'gemini' ? makeActiveCredential({ provider: 'gemini' }) : null,
    );

    await expect(service.updatePreferences('user-1', dto)).rejects.toSatisfy((error: unknown) => {
      expect((error as ApiException).message).toMatch(/de resumen de sesión \(brief\)/);
      return true;
    });
  });
});
