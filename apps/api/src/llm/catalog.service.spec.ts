import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CACHE_TTL_SECONDS,
  DEFAULT_AVG_TOKENS_IN,
  DEFAULT_AVG_TOKENS_OUT,
  ModelCatalogService,
  type CacheStore,
  type CatalogModel,
} from './catalog.service.js';

const FIXTURE_PATH = fileURLToPath(new URL('../../fixtures/llm/openrouter-models.json', import.meta.url));
const FIXTURE_JSON = readFileSync(FIXTURE_PATH, 'utf-8');

const API_KEY = 'sk-or-v1-SUPERSECRETA-0123456789';

/** `CacheStore` en memoria para tests, sin Redis (PR-08/T3 lo implementará de verdad). */
class InMemoryCache implements CacheStore {
  private readonly store = new Map<string, string>();
  readonly setCalls: Array<{ key: string; value: string; ttlSeconds: number }> = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, value);
    this.setCalls.push({ key, value, ttlSeconds });
  }
}

function okFetch(body: string): { fetchImpl: typeof fetch; calls: number[] } {
  const calls: number[] = [];
  const fetchImpl = (async (_input: unknown, _init?: unknown) => {
    calls.push(Date.now());
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function failingFetch(message = 'network down'): { fetchImpl: typeof fetch; calls: number[] } {
  const calls: number[] = [];
  const fetchImpl = (async () => {
    calls.push(Date.now());
    throw new Error(message);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function makeService(fetchImpl: typeof fetch, cache: CacheStore = new InMemoryCache()) {
  return new ModelCatalogService({ cache, fetchImpl });
}

describe('ModelCatalogService', () => {
  describe('tiers (SPEC-03 §7)', () => {
    it('clasifica los modelos en los tres tiers correctamente', async () => {
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl);

      const models = await service.listOpenRouterModels();

      // 20 modelos en el fixture, 3 excluidos (2 por contexto < 8k, 1 sin texto).
      expect(models).toHaveLength(17);

      const free = models.filter((m) => m.tier === 'free');
      const budget = models.filter((m) => m.tier === 'budget');
      const premium = models.filter((m) => m.tier === 'premium');

      expect(free).toHaveLength(3);
      expect(budget).toHaveLength(7);
      expect(premium).toHaveLength(7);

      const byId = new Map(models.map((m) => [m.id, m]));
      expect(byId.get('inclusionai/ling-3.0-flash-sante:free')?.tier).toBe('free');
      expect(byId.get('mistralai/mistral-nemo')?.tier).toBe('budget');
      expect(byId.get('anthropic/claude-sonnet-4.5')?.tier).toBe('premium');
    });

    it('excluye los modelos sin texto en las modalidades y los de contexto < 8k', async () => {
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl);

      const models = await service.listOpenRouterModels();
      const ids = models.map((m) => m.id);

      expect(ids).not.toContain('openai/text-embedding-3-large'); // sin texto de salida
      expect(ids).not.toContain('openai/gpt-3.5-turbo-0613'); // contexto 4095 < 8000
      expect(ids).not.toContain('undi95/remm-slerp-l2-13b'); // contexto 6144 < 8000
    });

    it('cada modelo del catálogo trae el proveedor, precios y contexto correctos', async () => {
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl);

      const models = await service.listOpenRouterModels();
      const sonnet = models.find((m) => m.id === 'anthropic/claude-sonnet-4.5');

      expect(sonnet).toBeDefined();
      expect(sonnet?.provider).toBe('openrouter');
      expect(sonnet?.contextLength).toBe(1_000_000);
      expect(sonnet?.pricePerMillionIn).toBeCloseTo(3, 6);
      expect(sonnet?.pricePerMillionOut).toBeCloseTo(15, 6);
    });
  });

  describe('caché (SPEC-03 §7)', () => {
    it('la segunda llamada no vuelve a hacer fetch y usa la caché con TTL de 6h', async () => {
      const { fetchImpl, calls } = okFetch(FIXTURE_JSON);
      const cache = new InMemoryCache();
      const service = makeService(fetchImpl, cache);

      const first = await service.listOpenRouterModels();
      const second = await service.listOpenRouterModels();

      expect(calls).toHaveLength(1);
      expect(second).toEqual(first);

      expect(cache.setCalls).toHaveLength(1);
      expect(cache.setCalls[0]?.key).toBe('llm:catalog:openrouter');
      expect(cache.setCalls[0]?.ttlSeconds).toBe(CACHE_TTL_SECONDS);
      expect(CACHE_TTL_SECONDS).toBe(21_600);
    });

    it('si el fetch falla pero hay caché, devuelve el catálogo cacheado', async () => {
      const cache = new InMemoryCache();
      await cache.set('llm:catalog:openrouter', FIXTURE_JSON, CACHE_TTL_SECONDS);

      const { fetchImpl } = failingFetch();
      const service = makeService(fetchImpl, cache);

      const models = await service.listOpenRouterModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === 'anthropic/claude-sonnet-4.5')).toBe(true);
    });

    it('si el fetch falla y no hay caché, lanza un error claro', async () => {
      const { fetchImpl } = failingFetch();
      const service = makeService(fetchImpl, new InMemoryCache());

      await expect(service.listOpenRouterModels()).rejects.toThrow(/catálogo de OpenRouter/);
    });
  });

  describe('refresh (SPEC-05 §8)', () => {
    it('fuerza una descarga real incluso con la caché ya poblada', async () => {
      const cache = new InMemoryCache();
      await cache.set('llm:catalog:openrouter', FIXTURE_JSON, CACHE_TTL_SECONDS);
      const { fetchImpl, calls } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl, cache);

      await service.refresh();

      expect(calls).toHaveLength(1);
    });

    it('sobreescribe la entrada de caché con el resultado de la nueva descarga', async () => {
      const OLD_JSON = JSON.stringify({ data: [] });
      const cache = new InMemoryCache();
      await cache.set('llm:catalog:openrouter', OLD_JSON, CACHE_TTL_SECONDS);
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl, cache);

      await service.refresh();

      const cached = await cache.get('llm:catalog:openrouter');
      expect(cached).toBe(FIXTURE_JSON);
      expect(cache.setCalls.at(-1)?.ttlSeconds).toBe(CACHE_TTL_SECONDS);
    });

    it('si la descarga falla, propaga el error y no toca la entrada de caché anterior', async () => {
      const cache = new InMemoryCache();
      await cache.set('llm:catalog:openrouter', FIXTURE_JSON, CACHE_TTL_SECONDS);
      const { fetchImpl } = failingFetch('network down');
      const service = makeService(fetchImpl, cache);

      await expect(service.refresh()).rejects.toThrow('network down');

      const cached = await cache.get('llm:catalog:openrouter');
      expect(cached).toBe(FIXTURE_JSON);
    });
  });

  describe('Gemini y listModels', () => {
    it('listModels incluye los 3 modelos fijos de Gemini', async () => {
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const service = makeService(fetchImpl);

      const models = await service.listModels();
      const geminiIds = models.filter((m) => m.provider === 'gemini').map((m) => m.id);

      expect(geminiIds.sort()).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']);
    });
  });

  describe('estimatePerSession (SPEC-03 §7)', () => {
    it('calcula avgIn * priceIn + avgOut * priceOut para un modelo de precio conocido', () => {
      const service = makeService(okFetch(FIXTURE_JSON).fetchImpl);
      const model: CatalogModel = {
        id: 'anthropic/claude-sonnet-4.5',
        provider: 'openrouter',
        name: 'Claude Sonnet 4.5',
        contextLength: 1_000_000,
        pricePerMillionIn: 3,
        pricePerMillionOut: 15,
        tier: 'premium',
      };

      const cost = service.estimatePerSession(1000, 1000, model);
      expect(cost).toBeCloseTo(0.018, 8);
    });

    it('usa los valores por defecto (9000 entrada / 2500 salida) en estimatePerSessionWithDefaults', () => {
      const service = makeService(okFetch(FIXTURE_JSON).fetchImpl);
      const model: CatalogModel = {
        id: 'anthropic/claude-sonnet-4.5',
        provider: 'openrouter',
        name: 'Claude Sonnet 4.5',
        contextLength: 1_000_000,
        pricePerMillionIn: 3,
        pricePerMillionOut: 15,
        tier: 'premium',
      };

      expect(DEFAULT_AVG_TOKENS_IN).toBe(9000);
      expect(DEFAULT_AVG_TOKENS_OUT).toBe(2500);

      const cost = service.estimatePerSessionWithDefaults(model);
      expect(cost).toBeCloseTo(0.0645, 8);
      expect(cost).toBeCloseTo(service.estimatePerSession(9000, 2500, model), 12);
    });

    it('un modelo gratuito estima 0 USD', () => {
      const service = makeService(okFetch(FIXTURE_JSON).fetchImpl);
      const freeModel: CatalogModel = {
        id: 'inclusionai/ling-3.0-flash-sante:free',
        provider: 'openrouter',
        name: 'Ling 3.0 Flash Sante (free)',
        contextLength: 262_144,
        pricePerMillionIn: 0,
        pricePerMillionOut: 0,
        tier: 'free',
      };

      expect(service.estimatePerSessionWithDefaults(freeModel)).toBe(0);
    });
  });

  describe('seguridad de la API key', () => {
    it('la key nunca aparece en lo que se guarda en la caché', async () => {
      const { fetchImpl } = okFetch(FIXTURE_JSON);
      const cache = new InMemoryCache();
      const service = makeService(fetchImpl, cache);

      await service.listOpenRouterModels(API_KEY);

      for (const call of cache.setCalls) {
        expect(call.value).not.toContain(API_KEY);
      }
    });

    it('la key nunca aparece en el mensaje de error cuando falla la descarga y no hay caché', async () => {
      const { fetchImpl } = failingFetch(`fallo con key ${API_KEY} filtrada por accidente`);
      const service = makeService(fetchImpl, new InMemoryCache());

      await expect(service.listOpenRouterModels(API_KEY)).rejects.toSatisfy((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return !message.includes(API_KEY);
      });
    });
  });
});
