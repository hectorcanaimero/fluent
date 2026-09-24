import {
  CACHE_TTL_SECONDS,
  DEFAULT_AVG_TOKENS_IN,
  DEFAULT_AVG_TOKENS_OUT,
  ModelCatalogService,
  type CacheStore,
  type CatalogModel,
} from './catalog.service.js';
import { NINEROUTER_MODELS, reasoningEffortFor } from './ninerouter-models.js';

const API_KEY = 'sk-9router-SUPERSECRETA-0123456789';
const BASE_URL = 'http://router.test/v1';
const CACHE_KEY = 'llm:catalog:9router';

/** Respuesta de `/v1/models`: los ids de la lista fija menos `missing`, más uno ajeno. */
function routerBody(missing: string[] = []): string {
  const ids = [...NINEROUTER_MODELS.map((m) => m.id).filter((id) => !missing.includes(id)), 'openai/gpt-5.1'];
  return JSON.stringify({ data: ids.map((id) => ({ id })) });
}
const BODY = routerBody();

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

function okFetch(body: string): { fetchImpl: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
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
  return new ModelCatalogService({ cache, fetchImpl, baseUrl: BASE_URL, apiKey: API_KEY });
}

const FREE_MODEL: CatalogModel = NINEROUTER_MODELS.find((m) => m.id === 'fluent-free')!;

describe('ModelCatalogService', () => {
  describe('listModels: intersección con la lista fija', () => {
    it('pide {baseUrl}/models con Authorization Bearer de la key del operador', async () => {
      const { fetchImpl, calls } = okFetch(BODY);
      await makeService(fetchImpl).listModels();

      expect(calls[0]?.url).toBe(`${BASE_URL}/models`);
      expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    });

    it('devuelve los modelos de la lista fija presentes en la respuesta, con los datos de la lista', async () => {
      const models = await makeService(okFetch(BODY).fetchImpl).listModels();

      expect(models).toEqual(NINEROUTER_MODELS);
      expect(models.find((m) => m.id === 'fluent-free')).toMatchObject({ tier: 'free', pricePerMillionOut: 0 });
    });

    it('no expone un id de la lista fija que 9router no devuelve', async () => {
      const models = await makeService(okFetch(routerBody(['ds/deepseek-v4-flash'])).fetchImpl).listModels();

      expect(models.map((m) => m.id)).not.toContain('ds/deepseek-v4-flash');
      expect(models).toHaveLength(NINEROUTER_MODELS.length - 1);
    });

    it('no expone ids que 9router devuelve pero no están en la lista fija', async () => {
      const models = await makeService(okFetch(BODY).fetchImpl).listModels();

      expect(models.map((m) => m.id)).not.toContain('openai/gpt-5.1');
    });
  });

  describe('caché (SPEC-03 §7)', () => {
    it('la segunda llamada no vuelve a hacer fetch y usa la caché con TTL de 6h', async () => {
      const { fetchImpl, calls } = okFetch(BODY);
      const cache = new InMemoryCache();
      const service = makeService(fetchImpl, cache);

      const first = await service.listModels();
      const second = await service.listModels();

      expect(calls).toHaveLength(1);
      expect(second).toEqual(first);
      expect(cache.setCalls).toHaveLength(1);
      expect(cache.setCalls[0]?.key).toBe(CACHE_KEY);
      expect(cache.setCalls[0]?.ttlSeconds).toBe(CACHE_TTL_SECONDS);
      expect(CACHE_TTL_SECONDS).toBe(21_600);
    });

    it('si el fetch falla pero hay caché, devuelve el catálogo cacheado', async () => {
      const cache = new InMemoryCache();
      await cache.set(CACHE_KEY, BODY, CACHE_TTL_SECONDS);

      const models = await makeService(failingFetch().fetchImpl, cache).listModels();
      expect(models.some((m) => m.id === 'fluent-free')).toBe(true);
    });

    it('si el fetch falla y no hay caché, lanza un error claro', async () => {
      const service = makeService(failingFetch().fetchImpl, new InMemoryCache());

      await expect(service.listModels()).rejects.toThrow(/catálogo de 9router/);
    });
  });

  describe('refresh (SPEC-05 §8)', () => {
    it('fuerza una descarga real incluso con la caché ya poblada', async () => {
      const cache = new InMemoryCache();
      await cache.set(CACHE_KEY, BODY, CACHE_TTL_SECONDS);
      const { fetchImpl, calls } = okFetch(BODY);

      await makeService(fetchImpl, cache).refresh();

      expect(calls).toHaveLength(1);
    });

    it('sobreescribe la entrada de caché con el resultado de la nueva descarga', async () => {
      const cache = new InMemoryCache();
      await cache.set(CACHE_KEY, JSON.stringify({ data: [] }), CACHE_TTL_SECONDS);

      await makeService(okFetch(BODY).fetchImpl, cache).refresh();

      expect(await cache.get(CACHE_KEY)).toBe(BODY);
      expect(cache.setCalls.at(-1)?.ttlSeconds).toBe(CACHE_TTL_SECONDS);
    });

    it('si la descarga falla, propaga el error y no toca la entrada de caché anterior', async () => {
      const cache = new InMemoryCache();
      await cache.set(CACHE_KEY, BODY, CACHE_TTL_SECONDS);

      await expect(makeService(failingFetch('network down').fetchImpl, cache).refresh()).rejects.toThrow(
        'network down',
      );
      expect(await cache.get(CACHE_KEY)).toBe(BODY);
    });
  });

  describe('estimatePerSession (SPEC-03 §7)', () => {
    const premium: CatalogModel = {
      id: 'p',
      provider: '9router',
      name: 'P',
      contextLength: 1_000_000,
      pricePerMillionIn: 3,
      pricePerMillionOut: 15,
      tier: 'premium',
    };

    it('calcula avgIn * priceIn + avgOut * priceOut', () => {
      const service = makeService(okFetch(BODY).fetchImpl);
      expect(service.estimatePerSession(1000, 1000, premium)).toBeCloseTo(0.018, 8);
    });

    it('usa los valores por defecto (9000 entrada / 2500 salida) en estimatePerSessionWithDefaults', () => {
      const service = makeService(okFetch(BODY).fetchImpl);

      expect(DEFAULT_AVG_TOKENS_IN).toBe(9000);
      expect(DEFAULT_AVG_TOKENS_OUT).toBe(2500);
      expect(service.estimatePerSessionWithDefaults(premium)).toBeCloseTo(0.0645, 8);
    });

    it('un modelo gratuito estima 0 USD', () => {
      expect(makeService(okFetch(BODY).fetchImpl).estimatePerSessionWithDefaults(FREE_MODEL)).toBe(0);
    });
  });

  describe('seguridad de la API key', () => {
    it('la key nunca aparece en lo que se guarda en la caché', async () => {
      const cache = new InMemoryCache();
      await makeService(okFetch(BODY).fetchImpl, cache).listModels();

      for (const call of cache.setCalls) expect(call.value).not.toContain(API_KEY);
    });

    it('la key nunca aparece en el mensaje de error cuando falla la descarga y no hay caché', async () => {
      const { fetchImpl } = failingFetch(`fallo con key ${API_KEY} filtrada por accidente`);

      await expect(makeService(fetchImpl).listModels()).rejects.toSatisfy((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return !message.includes(API_KEY);
      });
    });
  });
});

describe('reasoningEffortFor', () => {
  it('usa el id exacto de la lista fija', () => {
    expect(reasoningEffortFor('fluent-free')).toBe('none');
    expect(reasoningEffortFor('gemini/gemini-3.8-flash')).toBe('low');
    expect(reasoningEffortFor('gemini/gemini-3.5-flash-lite')).toBeUndefined();
  });

  it('cae al prefijo ds/ → none y gemini/gemini-3.8 → low para ids fuera de la lista', () => {
    expect(reasoningEffortFor('ds/deepseek-v5')).toBe('none');
    expect(reasoningEffortFor('gemini/gemini-3.8-pro')).toBe('low');
    expect(reasoningEffortFor('cf/@cf/otro')).toBeUndefined();
  });
});
