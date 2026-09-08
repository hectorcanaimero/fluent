import { createHash } from 'node:crypto';
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
import {
  GEMINI_MODELS_URL,
  OPENROUTER_CREDITS_URL,
  OPENROUTER_KEYS_URL,
  PROVIDER_FETCH,
} from '../src/providers/provider-api.client.js';
import {
  credentialAad,
  decodeMasterKey,
  decryptSecret,
  fromByteaHex,
} from '../src/credentials/credentials.crypto.js';
import type { ProviderCredential } from '../src/db/schema.js';

/**
 * e2e de PR-02/T4 (credenciales cifradas y proveedores) contra la rama real
 * de InsForge `feat-api`: las escrituras en `provider_credentials` (con sus
 * tres columnas `bytea`) son de verdad; **solo** se simulan las llamadas
 * salientes a OpenRouter y a Gemini, que nunca se hacen contra los
 * proveedores reales.
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
      'se saltan los tests de proveedores (docs/tasks/PR-02-auth-y-api.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

/** Valores obviamente falsos: ninguna key real de proveedor entra en los tests. */
const FAKE_OPENROUTER_KEY = 'sk-or-v1-FAKE-e2e-openrouter-key-0123456789';
const FAKE_GEMINI_KEY = 'AIza-FAKE-e2e-gemini-key-0123456789';
const FAKE_AUTH_CODE = 'FAKE-e2e-openrouter-authorization-code';
const CALLBACK_URL = 'fluent://oauth/openrouter';

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
  body: unknown;
  headers: Record<string, string>;
}

maybeDescribe('Proveedores y credenciales cifradas (e2e, InsForge feat-api)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];

  /** Respuestas simuladas de OpenRouter/Gemini, por URL. Cada test las fija. */
  let handlers: Record<string, (call: FetchCall) => Response>;
  let fetchCalls: FetchCall[];

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const call: FetchCall = {
      url,
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>),
      ),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    fetchCalls.push(call);

    const handler = handlers[url];
    if (!handler) {
      throw new Error(`Llamada saliente no simulada en el e2e: ${url}`);
    }
    return handler(call);
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

  async function readCredentialRow(
    userId: string,
    provider: string,
  ): Promise<ProviderCredential | null> {
    const { data, error } = await admin.database
      .from('provider_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo leer provider_credentials: ${error.message}`);
    }
    return (data as ProviderCredential | null) ?? null;
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
      // El PKCE necesita Redis y aquí no hay uno real.
      .overrideProvider(REDIS_CACHE_CLIENT)
      .useValue(createRedisDouble())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 30_000);

  beforeEach(() => {
    handlers = {};
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
    'flujo PKCE completo: start -> complete -> credencial cifrada -> status con créditos -> delete',
    async () => {
      const user = await newUser('PKCE OpenRouter');
      handlers = {
        [OPENROUTER_KEYS_URL]: () => jsonResponse({ key: FAKE_OPENROUTER_KEY }),
        [OPENROUTER_CREDITS_URL]: () =>
          jsonResponse({ data: { total_credits: 10, total_usage: 2.5 } }),
      };

      // 1. start
      const startResponse = await request(app.getHttpServer())
        .post('/v1/providers/openrouter/pkce/start')
        .set(authHeader(user.accessToken))
        .send({ callbackUrl: CALLBACK_URL })
        .expect(201);

      const authUrl = new URL(startResponse.body.authUrl as string);
      expect(authUrl.origin + authUrl.pathname).toBe('https://openrouter.ai/auth');
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(authUrl.searchParams.get('callback_url')).toBe(CALLBACK_URL);
      expect(startResponse.body.codeVerifierId).toMatch(/^[0-9a-f-]{36}$/);

      // 2. complete
      const completeResponse = await request(app.getHttpServer())
        .post('/v1/providers/openrouter/pkce/complete')
        .set(authHeader(user.accessToken))
        .send({ code: FAKE_AUTH_CODE, codeVerifierId: startResponse.body.codeVerifierId })
        .expect(201);

      expect(completeResponse.body).toMatchObject({ status: 'active', lastError: null });
      expect(JSON.stringify(completeResponse.body)).not.toContain(FAKE_OPENROUTER_KEY);

      // El verifier enviado a OpenRouter corresponde al challenge del authUrl.
      const exchange = fetchCalls.find((call) => call.url === OPENROUTER_KEYS_URL)!;
      const exchangeBody = exchange.body as { code_verifier: string; code_challenge_method: string };
      expect(exchangeBody.code_challenge_method).toBe('S256');
      expect(
        createHash('sha256').update(exchangeBody.code_verifier, 'ascii').digest('base64url'),
      ).toBe(authUrl.searchParams.get('code_challenge'));

      // 3. La fila real está cifrada y se descifra con la clave maestra.
      const row = await readCredentialRow(user.id, 'openrouter');
      expect(row).not.toBeNull();
      expect(row!.status).toBe('active');
      expect(JSON.stringify(row)).not.toContain(FAKE_OPENROUTER_KEY);
      expect(fromByteaHex(row!.key_iv)).toHaveLength(12);
      expect(fromByteaHex(row!.key_tag)).toHaveLength(16);

      const masterKey = decodeMasterKey(
        process.env.CREDENTIALS_MASTER_KEY!,
        'CREDENTIALS_MASTER_KEY',
      );
      expect(
        decryptSecret(
          [masterKey],
          {
            ciphertext: fromByteaHex(row!.key_ciphertext),
            iv: fromByteaHex(row!.key_iv),
            tag: fromByteaHex(row!.key_tag),
          },
          credentialAad(user.id, 'openrouter'),
        ),
      ).toBe(FAKE_OPENROUTER_KEY);

      // 4. status con créditos (RF-2.3)
      const statusResponse = await request(app.getHttpServer())
        .get('/v1/providers/openrouter/status')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(statusResponse.body).toEqual({
        provider: 'openrouter',
        status: 'active',
        lastError: null,
        credits: { total: 10, used: 2.5 },
      });

      // 5. GET /me lo refleja
      const meResponse = await request(app.getHttpServer())
        .get('/v1/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(meResponse.body.providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: 'openrouter', status: 'active' }),
          expect.objectContaining({ provider: 'gemini', status: 'not_connected' }),
        ]),
      );

      // 6. delete -> vuelve a 'not_connected'
      await request(app.getHttpServer())
        .delete('/v1/providers/openrouter')
        .set(authHeader(user.accessToken))
        .expect(204);

      expect(await readCredentialRow(user.id, 'openrouter')).toBeNull();

      const afterDelete = await request(app.getHttpServer())
        .get('/v1/providers/openrouter/status')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(afterDelete.body).toEqual({
        provider: 'openrouter',
        status: 'not_connected',
        lastError: null,
      });
    },
    60_000,
  );

  it(
    'complete con un codeVerifierId inexistente responde 400 VALIDATION (no un 500)',
    async () => {
      const user = await newUser('PKCE Caducado');
      handlers = { [OPENROUTER_KEYS_URL]: () => jsonResponse({ key: FAKE_OPENROUTER_KEY }) };

      const response = await request(app.getHttpServer())
        .post('/v1/providers/openrouter/pkce/complete')
        .set(authHeader(user.accessToken))
        .send({
          code: FAKE_AUTH_CODE,
          codeVerifierId: '44444444-4444-4444-8444-444444444444',
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });
      // Ni siquiera se intentó canjear el código.
      expect(fetchCalls).toHaveLength(0);
      expect(await readCredentialRow(user.id, 'openrouter')).toBeNull();
    },
    60_000,
  );

  it(
    'key inválida de Gemini responde 400 PROVIDER_KEY_INVALID y no guarda nada',
    async () => {
      const user = await newUser('Gemini Invalida');
      handlers = {
        [GEMINI_MODELS_URL]: () =>
          jsonResponse({ error: { code: 401, message: 'API key not valid' } }, 401),
      };

      const response = await request(app.getHttpServer())
        .post('/v1/providers/gemini')
        .set(authHeader(user.accessToken))
        .send({ apiKey: 'AIza-FAKE-invalida' })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'PROVIDER_KEY_INVALID', statusCode: 400 });
      expect(await readCredentialRow(user.id, 'gemini')).toBeNull();
    },
    60_000,
  );

  it(
    'key válida de Gemini queda guardada cifrada y con status active',
    async () => {
      const user = await newUser('Gemini Valida');
      handlers = { [GEMINI_MODELS_URL]: () => jsonResponse({ data: [{ id: 'gemini-2.5-flash' }] }) };

      const response = await request(app.getHttpServer())
        .post('/v1/providers/gemini')
        .set(authHeader(user.accessToken))
        .send({ apiKey: FAKE_GEMINI_KEY })
        .expect(201);

      expect(response.body).toMatchObject({ status: 'active', lastError: null });
      expect(fetchCalls[0]?.headers.Authorization).toBe(`Bearer ${FAKE_GEMINI_KEY}`);

      const row = await readCredentialRow(user.id, 'gemini');
      expect(row).not.toBeNull();
      expect(JSON.stringify(row)).not.toContain(FAKE_GEMINI_KEY);

      const masterKey = decodeMasterKey(
        process.env.CREDENTIALS_MASTER_KEY!,
        'CREDENTIALS_MASTER_KEY',
      );
      expect(
        decryptSecret(
          [masterKey],
          {
            ciphertext: fromByteaHex(row!.key_ciphertext),
            iv: fromByteaHex(row!.key_iv),
            tag: fromByteaHex(row!.key_tag),
          },
          credentialAad(user.id, 'gemini'),
        ),
      ).toBe(FAKE_GEMINI_KEY);
    },
    60_000,
  );

  it(
    'un proveedor desconocido en la ruta responde 400 VALIDATION',
    async () => {
      const user = await newUser('Proveedor Raro');

      const response = await request(app.getHttpServer())
        .get('/v1/providers/anthropic/status')
        .set(authHeader(user.accessToken))
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });
    },
    60_000,
  );
});
