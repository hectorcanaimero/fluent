import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  loadInsforgeE2eCredentials,
  registerE2eUser,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';
import { REDIS_CACHE_CLIENT } from '../src/redis/redis.constants.js';
import { PROVIDER_FETCH } from '../src/providers/provider-api.client.js';
import { NINEROUTER_MODELS } from '../src/llm/ninerouter-models.js';

/**
 * e2e de PR-02/T5 (catálogo y preferencias de modelo) contra la rama real de
 * InsForge `feat-api`: las escrituras en `provider_credentials` y
 * `model_preferences` son de verdad; **solo** se simulan las llamadas
 * salientes a 9router (`GET /models`, catálogo), como hace `providers.e2e-spec.ts` de T4 — el mismo patrón:
 * `PROVIDER_FETCH` inyectado y un doble en memoria de Redis.
 *
 * Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` / `INSFORGE_ANON_KEY` en
 * `process.env` o en el archivo gitignored `apps/api/.env.test.local`; si no
 * están, se salta entero (el CI no tiene acceso a InsForge).
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de catálogo y preferencias de modelo (docs/tasks/PR-02-auth-y-api.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

/** Respuesta simulada de `GET {NINEROUTER_URL}/models`: todos los ids de la lista fija. */
const ROUTER_MODELS_BODY = { data: NINEROUTER_MODELS.map((m) => ({ id: m.id })) };

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Doble de Redis en memoria: el VPS de desarrollo no tiene Redis levantado. */
function createRedisDouble() {
  const store = new Map<string, string>();
  return {
    ping: async () => 'PONG',
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    },
    del: async (key: string) => (store.delete(key) ? 1 : 0),
  };
}

interface FetchCall {
  url: string;
  headers: Record<string, string>;
}

maybeDescribe('Catálogo y preferencias de modelo (e2e, InsForge feat-api)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];

  let fetchCalls: FetchCall[];

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    fetchCalls.push({
      url,
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
    });

    if (!url.endsWith('/models')) {
      throw new Error(`Llamada saliente no simulada en el e2e: ${url}`);
    }
    return jsonResponse(ROUTER_MODELS_BODY);
  };

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function newUser(namePrefix: string): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Nunca se llama a 9router de verdad.
      .overrideProvider(PROVIDER_FETCH)
      .useValue(fakeFetch)
      // El catálogo se cachea en Redis (`ModelCatalogService`, PR-03); aquí
      // no hay uno real levantado (docs/specs/pendientes/PR-02.md PEND-32).
      .overrideProvider(REDIS_CACHE_CLIENT)
      .useValue(createRedisDouble())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 30_000);

  beforeEach(() => {
    fetchCalls = [];
  });

  afterAll(async () => {
    for (const userId of seededUserIds) {
      await admin.database.from('provider_credentials').delete().eq('user_id', userId);
      await admin.database.from('model_preferences').delete().eq('user_id', userId);
    }
    await cleanupE2eData(admin, { userIds: seededUserIds });
    await app.close();
  }, 30_000);

  it(
    'GET /models devuelve providers[9router] con fluent-free en free y un estimatePerSession con una entrada por modelo',
    async () => {
      const user = await newUser('Catalogo');

      const response = await request(app.getHttpServer())
        .get('/v1/models')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(Object.keys(response.body.providers)).toEqual(['9router']);
      const group = response.body.providers['9router'] as Record<
        'free' | 'budget' | 'premium',
        Array<{ id: string; name: string; pricePerMillionUsd: number }>
      >;
      expect(group.free.map((m) => m.id)).toContain('fluent-free');
      expect(group.premium.map((m) => m.id)).toContain('fluent-pro');

      const allModelIds = [...group.free, ...group.budget, ...group.premium].map((m) => m.id);
      expect(Object.keys(response.body.estimatePerSession).sort()).toEqual([...allModelIds].sort());
      for (const id of allModelIds) {
        expect(typeof response.body.estimatePerSession[id]).toBe('number');
      }
      expect(fetchCalls[0]?.headers.Authorization).toMatch(/^Bearer /);
    },
    30_000,
  );

  it(
    'PUT /me/models con modelos del catálogo -> 200 y GET /me lo refleja',
    async () => {
      const user = await newUser('Con Modelos');
      const body = {
        chatProvider: '9router',
        chatModel: 'fluent-free',
        briefProvider: '9router',
        briefModel: 'fluent-pro',
      };

      const putResponse = await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send(body)
        .expect(200);
      expect(putResponse.body).toEqual(body);

      const meResponse = await request(app.getHttpServer())
        .get('/v1/me')
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(meResponse.body.modelPreference).toEqual(body);
    },
    30_000,
  );

  it(
    'un modelo que no está en el catálogo -> 400 MODEL_NOT_AVAILABLE',
    async () => {
      const user = await newUser('Modelo Invalido');

      const response = await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send({
          chatProvider: '9router',
          chatModel: 'no-existe',
          briefProvider: '9router',
          briefModel: 'fluent-free',
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'MODEL_NOT_AVAILABLE', statusCode: 400 });
      expect(response.body.message).toMatch(/no está en el catálogo/);
    },
    30_000,
  );
});
