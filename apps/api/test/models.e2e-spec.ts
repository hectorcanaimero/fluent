import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
import { GEMINI_MODELS_URL, PROVIDER_FETCH } from '../src/providers/provider-api.client.js';
import { PROVIDERS } from '../src/llm/config.js';

/**
 * e2e de PR-02/T5 (catálogo y preferencias de modelo) contra la rama real de
 * InsForge `feat-api`: las escrituras en `provider_credentials` y
 * `model_preferences` son de verdad; **solo** se simulan las llamadas
 * salientes a OpenRouter (`GET /models`, catálogo) y Gemini (validación de
 * key), como hace `providers.e2e-spec.ts` de T4 — el mismo patrón:
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

/** Catálogo real de OpenRouter (fixture de PR-03), usado como respuesta simulada. */
const OPENROUTER_MODELS_URL = `${PROVIDERS.openrouter.baseUrl}/models`;
const FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/llm/openrouter-models.json', import.meta.url),
);
const FIXTURE_JSON = readFileSync(FIXTURE_PATH, 'utf-8');

const FAKE_GEMINI_KEY = 'AIza-FAKE-e2e-gemini-key-0123456789';

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

  /** Respuestas simuladas de OpenRouter/Gemini, por URL. Cada test añade las suyas. */
  let handlers: Record<string, () => Response>;
  let fetchCalls: FetchCall[];

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    fetchCalls.push({
      url,
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
    });

    const handler = handlers[url];
    if (!handler) {
      throw new Error(`Llamada saliente no simulada en el e2e: ${url}`);
    }
    return handler();
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

  /** Conecta Gemini con una key simulada como válida (POST /providers/gemini). */
  async function connectGemini(user: E2eTestUser): Promise<void> {
    handlers[GEMINI_MODELS_URL] = () => jsonResponse({ data: [{ id: 'gemini-2.5-flash' }] });

    await request(app.getHttpServer())
      .post('/v1/providers/gemini')
      .set(authHeader(user.accessToken))
      .send({ apiKey: FAKE_GEMINI_KEY })
      .expect(201);
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Nunca se llama a OpenRouter ni a Google de verdad.
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
    // El catálogo de OpenRouter se necesita en casi todos los tests: `GET
    // /models` y `PUT /me/models` siempre bajan el catálogo completo antes
    // de validar el rol elegido.
    handlers = { [OPENROUTER_MODELS_URL]: () => jsonResponse(JSON.parse(FIXTURE_JSON) as unknown) };
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
    'GET /models devuelve las dos claves de proveedor, los tres tiers y un estimatePerSession con una entrada por modelo',
    async () => {
      const user = await newUser('Catalogo');

      const response = await request(app.getHttpServer())
        .get('/v1/models')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(Object.keys(response.body.providers).sort()).toEqual(['gemini', 'openrouter']);
      for (const provider of ['openrouter', 'gemini'] as const) {
        expect(response.body.providers[provider]).toEqual(
          expect.objectContaining({
            free: expect.any(Array),
            budget: expect.any(Array),
            premium: expect.any(Array),
          }),
        );
      }

      // Los 3 modelos fijos de Gemini (SPEC-03 §7) están todos, repartidos
      // entre budget/premium (ninguno es gratis).
      expect(
        response.body.providers.gemini.budget.length + response.body.providers.gemini.premium.length,
      ).toBe(3);
      expect(response.body.providers.gemini.free.length).toBe(0);
      // El fixture de OpenRouter trae modelos en los tres tiers.
      expect(response.body.providers.openrouter.free.length).toBeGreaterThan(0);
      expect(response.body.providers.openrouter.budget.length).toBeGreaterThan(0);
      expect(response.body.providers.openrouter.premium.length).toBeGreaterThan(0);

      const allModelIds = (
        [
          ...response.body.providers.openrouter.free,
          ...response.body.providers.openrouter.budget,
          ...response.body.providers.openrouter.premium,
          ...response.body.providers.gemini.free,
          ...response.body.providers.gemini.budget,
          ...response.body.providers.gemini.premium,
        ] as Array<{ id: string; name: string; pricePerMillionUsd: number }>
      ).map((m) => m.id);

      expect(Object.keys(response.body.estimatePerSession).sort()).toEqual([...allModelIds].sort());
      for (const id of allModelIds) {
        expect(typeof response.body.estimatePerSession[id]).toBe('number');
      }
    },
    30_000,
  );

  it(
    'usuario sin Gemini elige un modelo de Gemini para el rol de chat -> 400 MODEL_NOT_AVAILABLE',
    async () => {
      const user = await newUser('Sin Gemini');

      const response = await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send({
          chatProvider: 'gemini',
          chatModel: 'gemini-2.5-flash',
          briefProvider: 'openrouter',
          briefModel: 'anthropic/claude-sonnet-4.5',
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'MODEL_NOT_AVAILABLE', statusCode: 400 });
      expect(response.body.message).toMatch(/credencial activa/);
    },
    30_000,
  );

  it(
    'con credencial de Gemini activa, elegir modelos de Gemini -> 200 y GET /me lo refleja',
    async () => {
      const user = await newUser('Con Gemini');
      await connectGemini(user);

      const putResponse = await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send({
          chatProvider: 'gemini',
          chatModel: 'gemini-2.5-flash',
          briefProvider: 'gemini',
          briefModel: 'gemini-2.5-flash-lite',
        })
        .expect(200);

      expect(putResponse.body).toEqual({
        chatProvider: 'gemini',
        chatModel: 'gemini-2.5-flash',
        briefProvider: 'gemini',
        briefModel: 'gemini-2.5-flash-lite',
      });

      const meResponse = await request(app.getHttpServer())
        .get('/v1/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(meResponse.body.modelPreference).toEqual({
        chatProvider: 'gemini',
        chatModel: 'gemini-2.5-flash',
        briefProvider: 'gemini',
        briefModel: 'gemini-2.5-flash-lite',
      });
    },
    30_000,
  );

  it(
    'un modelo que no está en el catálogo del proveedor -> 400 MODEL_NOT_AVAILABLE (aunque haya credencial)',
    async () => {
      const user = await newUser('Modelo Invalido');
      await connectGemini(user);

      const response = await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send({
          chatProvider: 'gemini',
          chatModel: 'gemini-no-existe',
          briefProvider: 'gemini',
          briefModel: 'gemini-2.5-flash',
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'MODEL_NOT_AVAILABLE', statusCode: 400 });
      expect(response.body.message).toMatch(/no está en el catálogo/);
    },
    30_000,
  );

  it(
    'desconectar el proveedor borra la preferencia que lo usaba (PEND-26, integración con T4)',
    async () => {
      const user = await newUser('Reset Preferencias');
      await connectGemini(user);

      await request(app.getHttpServer())
        .put('/v1/me/models')
        .set(authHeader(user.accessToken))
        .send({
          chatProvider: 'gemini',
          chatModel: 'gemini-2.5-flash',
          briefProvider: 'gemini',
          briefModel: 'gemini-2.5-flash-lite',
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete('/v1/providers/gemini')
        .set(authHeader(user.accessToken))
        .expect(204);

      const meResponse = await request(app.getHttpServer())
        .get('/v1/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(meResponse.body.modelPreference).toBeNull();
    },
    30_000,
  );
});
