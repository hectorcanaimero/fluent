import { createHash, randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { CredentialsCrypto, MASTER_KEY_BYTES } from '../credentials/credentials.crypto.js';
import type {
  CredentialRowInput,
  CredentialsRepository,
} from '../credentials/credentials.repository.js';
import { CredentialsService } from '../credentials/credentials.service.js';
import type { Provider, ProviderCredential } from '../db/schema.js';
import type { RedisService } from '../redis/redis.service.js';
import type { ModelPreferencesRepository } from '../models/model-preferences.repository.js';
import { PkceStore, PKCE_TTL_SECONDS } from './pkce.store.js';
import {
  GEMINI_MODELS_URL,
  OPENROUTER_CREDITS_URL,
  OPENROUTER_KEYS_URL,
  ProviderApiClient,
  type FetchLike,
} from './provider-api.client.js';
import { parseProvider, ProvidersService } from './providers.service.js';

/**
 * Tests de `ProvidersModule` con OpenRouter y Gemini **simulados**: el `fetch`
 * se inyecta (token `PROVIDER_FETCH` en producción, un doble aquí), así que
 * nunca se llama a un proveedor real. El cifrado sí es el de verdad
 * (`CredentialsService` con una clave maestra de juguete generada en el test).
 */

/** Valores obviamente falsos. Ninguna key real entra en los tests. */
const FAKE_OPENROUTER_KEY = 'sk-or-v1-FAKE-openrouter-key-0123456789';
const FAKE_GEMINI_KEY = 'AIza-FAKE-gemini-key-0123456789';
const FAKE_AUTH_CODE = 'FAKE-openrouter-authorization-code';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const DEFAULT_CALLBACK = 'fluent://oauth/openrouter';
const API_PUBLIC_URL = 'https://api.test';

interface FetchCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

type Handler = (call: FetchCall) => Response;

function createFakeFetch(handlers: Record<string, Handler>) {
  const calls: FetchCall[] = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    );
    const call: FetchCall = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    calls.push(call);

    const handler = handlers[url];
    if (!handler) {
      throw new Error(`Llamada saliente no simulada: ${url}`);
    }
    return handler(call);
  }) as FetchLike;

  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Doble en memoria de Redis, con la misma política de `RedisService`. */
function createFakeRedis() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    store,
    ttls,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ttlSeconds: number) => {
      store.set(key, value);
      ttls.set(key, ttlSeconds);
    }),
    del: vi.fn(async (key: string) => store.delete(key)),
  };
}

/** Doble en memoria de `CredentialsRepository` (igual que en su propio spec). */
function createFakeCredentialsRepository() {
  const rows = new Map<string, ProviderCredential>();
  const keyOf = (userId: string, provider: Provider) => `${userId}:${provider}`;

  return {
    rows,
    find: vi.fn(
      async (userId: string, provider: Provider) => rows.get(keyOf(userId, provider)) ?? null,
    ),
    listByUser: vi.fn(async (userId: string) =>
      [...rows.values()].filter((row) => row.user_id === userId),
    ),
    listActiveByUser: vi.fn(async (userId: string) =>
      [...rows.values()].filter((row) => row.user_id === userId && row.status === 'active'),
    ),
    save: vi.fn(async (input: CredentialRowInput) => {
      const row: ProviderCredential = {
        id: `cred-${rows.size + 1}`,
        user_id: input.userId,
        provider: input.provider,
        key_ciphertext: input.keyCiphertext,
        key_iv: input.keyIv,
        key_tag: input.keyTag,
        status: 'active',
        last_error: null,
        connected_at: new Date().toISOString(),
      };
      rows.set(keyOf(input.userId, input.provider), row);
      return row;
    }),
    markError: vi.fn(async (userId: string, provider: Provider, lastError: string) => {
      const row = rows.get(keyOf(userId, provider));
      if (!row) return false;
      rows.set(keyOf(userId, provider), { ...row, status: 'error', last_error: lastError });
      return true;
    }),
    remove: vi.fn(async (userId: string, provider: Provider) =>
      rows.delete(keyOf(userId, provider)),
    ),
    listStatuses: vi.fn(async () => []),
  };
}

function createHarness(handlers: Record<string, Handler>) {
  const redis = createFakeRedis();
  const credentialsRepository = createFakeCredentialsRepository();
  const credentialsService = new CredentialsService(
    new CredentialsCrypto({
      get: (key: string) =>
        key === 'CREDENTIALS_MASTER_KEY'
          ? randomBytes(MASTER_KEY_BYTES).toString('base64')
          : undefined,
    } as unknown as ConfigService<Env, true>),
    credentialsRepository as unknown as CredentialsRepository,
  );

  const { fetchImpl, calls } = createFakeFetch(handlers);
  const modelPreferences = {
    upsert: vi.fn(async (_u: string, patch: unknown) => patch),
    find: vi.fn(async () => null),
    deleteIfUsesProvider: vi.fn(async () => true),
  };

  const service = new ProvidersService(
    {
      get: (key: string) => (key === 'API_PUBLIC_URL' ? API_PUBLIC_URL : DEFAULT_CALLBACK),
    } as unknown as ConfigService<Env, true>,
    credentialsService,
    new PkceStore(redis as unknown as RedisService),
    new ProviderApiClient(fetchImpl),
    modelPreferences as unknown as ModelPreferencesRepository,
  );

  return { service, redis, credentialsRepository, credentialsService, calls, modelPreferences };
}

/** Handlers de `fetch` con el canje de OpenRouter respondiendo una key válida. */
function openRouterExchangeOk() {
  return {
    [OPENROUTER_KEYS_URL]: () => jsonResponse({ key: FAKE_OPENROUTER_KEY }),
  };
}

/** El `code_challenge` que viajó en el `authUrl` que devolvió `start`. */
function challengeOf(authUrl: string): string {
  return new URL(authUrl).searchParams.get('code_challenge') ?? '';
}

describe('ProvidersService', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseProvider', () => {
    it('accepts the two providers of SPEC-01 §2.4', () => {
      expect(parseProvider('openrouter')).toBe('openrouter');
      expect(parseProvider('GEMINI')).toBe('gemini');
    });

    it('rejects anything else with 400 VALIDATION', () => {
      expect(() => parseProvider('anthropic')).toThrow(ApiException);
      try {
        parseProvider('anthropic');
      } catch (error) {
        expect((error as ApiException).code).toBe('VALIDATION');
      }
    });
  });

  describe('POST /providers/openrouter/pkce/start', () => {
    it('returns an authUrl with code_challenge_method=S256 and stores the verifier 10 min', async () => {
      const { service, redis } = createHarness({});

      const result = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);

      const url = new URL(result.authUrl);
      expect(url.origin + url.pathname).toBe('https://openrouter.ai/auth');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      // OpenRouter vuelve al callback HTTPS de la API, que luego redirige al deep link.
      expect(url.searchParams.get('callback_url')).toBe(
        `${API_PUBLIC_URL}/v1/providers/openrouter/callback/${result.codeVerifierId}`,
      );
      expect(result.codeVerifierId).toMatch(/^[0-9a-f-]{36}$/);

      const key = `pkce:openrouter:${result.codeVerifierId}`;
      expect(redis.ttls.get(key)).toBe(PKCE_TTL_SECONDS);
      // El verifier vive en Redis, nunca en la respuesta.
      const stored = JSON.parse(redis.store.get(key)!) as { codeVerifier: string; userId: string };
      expect(stored.userId).toBe(USER_A);
      expect(JSON.stringify(result)).not.toContain(stored.codeVerifier);
    });

    it('falls back to OPENROUTER_OAUTH_CALLBACK when the body has no callbackUrl', async () => {
      const { service, redis } = createHarness({});

      const result = await service.startOpenRouterPkce(USER_A);

      // El deep link por defecto queda guardado en el intento para la redirección final.
      const stored = JSON.parse(redis.store.get(`pkce:openrouter:${result.codeVerifierId}`)!) as {
        callbackUrl: string;
      };
      expect(stored.callbackUrl).toBe(DEFAULT_CALLBACK);
    });

    it('rejects a callbackUrl that is not an absolute URL with 400 VALIDATION', async () => {
      const { service } = createHarness({});

      await expect(service.startOpenRouterPkce(USER_A, '/oauth/openrouter')).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    });
  });

  describe('POST /providers/openrouter/pkce/complete', () => {
    it('completes the PKCE flow: exchanges the code and stores the key encrypted', async () => {
      const harness = createHarness(openRouterExchangeOk());
      const { service, calls, credentialsRepository, credentialsService } = harness;

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);
      const status = await service.completeOpenRouterPkce(
        USER_A,
        started.codeVerifierId,
        FAKE_AUTH_CODE,
      );

      expect(status).toEqual({ provider: 'openrouter', status: 'active', lastError: null });

      // El canje se hizo contra el endpoint de SPEC-02 §4.2 con el verifier
      // que corresponde al challenge del authUrl.
      const exchange = calls.find((call) => call.url === OPENROUTER_KEYS_URL)!;
      const body = exchange.body as { code: string; code_verifier: string; code_challenge_method: string };
      expect(exchange.method).toBe('POST');
      expect(body.code).toBe(FAKE_AUTH_CODE);
      expect(body.code_challenge_method).toBe('S256');
      expect(createHash('sha256').update(body.code_verifier, 'ascii').digest('base64url')).toBe(
        challengeOf(started.authUrl),
      );

      // La key quedó cifrada en la tabla y se recupera igual que se guardó.
      const row = credentialsRepository.rows.get(`${USER_A}:openrouter`)!;
      expect(row.status).toBe('active');
      expect(row.last_error).toBeNull();
      expect(JSON.stringify(row)).not.toContain(FAKE_OPENROUTER_KEY);
      await expect(credentialsService.listActive(USER_A)).resolves.toEqual([
        { provider: 'openrouter', apiKey: FAKE_OPENROUTER_KEY },
      ]);
    });

    it('burns the verifier: the same codeVerifierId cannot be used twice', async () => {
      const { service, redis } = createHarness(openRouterExchangeOk());

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);
      await service.completeOpenRouterPkce(USER_A, started.codeVerifierId, FAKE_AUTH_CODE);

      expect(redis.store.size).toBe(0);
      await expect(
        service.completeOpenRouterPkce(USER_A, started.codeVerifierId, FAKE_AUTH_CODE),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('answers a controlled 403 (not a 500) for an unknown or expired codeVerifierId', async () => {
      const { service, calls } = createHarness(openRouterExchangeOk());

      const error = await service
        .completeOpenRouterPkce(USER_A, '44444444-4444-4444-8444-444444444444', FAKE_AUTH_CODE)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('FORBIDDEN');
      expect((error as ApiException).getStatus()).toBe(403);
      // Ni siquiera se llamó a OpenRouter.
      expect(calls).toHaveLength(0);
    });

    it('does not let a user complete the PKCE started by someone else', async () => {
      const { service, calls } = createHarness(openRouterExchangeOk());

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);

      await expect(
        service.completeOpenRouterPkce(USER_B, started.codeVerifierId, FAKE_AUTH_CODE),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(calls).toHaveLength(0);
    });

    it('maps a rejection from OpenRouter to PROVIDER_KEY_INVALID and stores nothing', async () => {
      const { service, credentialsRepository } = createHarness({
        [OPENROUTER_KEYS_URL]: () => jsonResponse({ error: 'invalid_grant' }, 400),
      });

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);

      await expect(
        service.completeOpenRouterPkce(USER_A, started.codeVerifierId, FAKE_AUTH_CODE),
      ).rejects.toMatchObject({ code: 'PROVIDER_KEY_INVALID' });
      expect(credentialsRepository.rows.size).toBe(0);
    });

    it('maps a response without a key to PROVIDER_KEY_INVALID', async () => {
      const { service, credentialsRepository } = createHarness({
        [OPENROUTER_KEYS_URL]: () => jsonResponse({ ok: true }),
      });

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);

      await expect(
        service.completeOpenRouterPkce(USER_A, started.codeVerifierId, FAKE_AUTH_CODE),
      ).rejects.toMatchObject({ code: 'PROVIDER_KEY_INVALID' });
      expect(credentialsRepository.rows.size).toBe(0);
    });
  });

  describe('GET /providers/openrouter/callback/:id · solo guarda el code (MAL-18)', () => {
    it('no canjea nada ni escribe credencial: solo deja el code en Redis', async () => {
      const { service, calls, credentialsRepository, redis } = createHarness(
        openRouterExchangeOk(),
      );

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);
      const result = await service.completeOpenRouterPkceFromBrowser(
        started.codeVerifierId,
        FAKE_AUTH_CODE,
      );

      expect(result).toMatchObject({ ok: true, redirectTo: `${DEFAULT_CALLBACK}?done=1` });
      // Ni una llamada a OpenRouter, ni una fila de credencial.
      expect(calls).toHaveLength(0);
      expect(credentialsRepository.rows.size).toBe(0);
      // El intento sigue vivo, ahora con el código guardado.
      expect(redis.store.size).toBe(1);
      const entry = JSON.parse([...redis.store.values()][0] as string) as { code?: string };
      expect(entry.code).toBe(FAKE_AUTH_CODE);
    });

    it('sin code redirige con error=expired y no toca la entrada', async () => {
      const { service, redis } = createHarness(openRouterExchangeOk());

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);
      const result = await service.completeOpenRouterPkceFromBrowser(
        started.codeVerifierId,
        undefined,
      );

      expect(result).toMatchObject({ ok: false, redirectTo: `${DEFAULT_CALLBACK}?error=expired` });
      const entry = JSON.parse([...redis.store.values()][0] as string) as { code?: string };
      expect(entry.code).toBeUndefined();
    });

    it('con un id desconocido redirige al callback por defecto con error=expired', async () => {
      const { service } = createHarness(openRouterExchangeOk());

      const result = await service.completeOpenRouterPkceFromBrowser(
        '44444444-4444-4444-8444-444444444444',
        FAKE_AUTH_CODE,
      );

      expect(result).toMatchObject({ ok: false, redirectTo: `${DEFAULT_CALLBACK}?error=expired` });
    });
  });

  describe('POST /pkce/complete tras el callback (MAL-18)', () => {
    /** Flujo nuevo completo: start → callback guarda el code → complete canjea. */
    async function startAndReturnFromBrowser(
      service: ProvidersService,
      userId = USER_A,
    ): Promise<string> {
      const started = await service.startOpenRouterPkce(userId, DEFAULT_CALLBACK);
      await service.completeOpenRouterPkceFromBrowser(started.codeVerifierId, FAKE_AUTH_CODE);
      return started.codeVerifierId;
    }

    it('el dueño canjea el code guardado sin mandarlo en el cuerpo', async () => {
      const harness = createHarness(openRouterExchangeOk());
      const { service, calls, credentialsService } = harness;

      const codeVerifierId = await startAndReturnFromBrowser(service);
      const status = await service.completeOpenRouterPkce(USER_A, codeVerifierId);

      expect(status).toEqual({ provider: 'openrouter', status: 'active', lastError: null });
      const exchange = calls.find((call) => call.url === OPENROUTER_KEYS_URL)!;
      expect((exchange.body as { code: string }).code).toBe(FAKE_AUTH_CODE);
      await expect(credentialsService.listActive(USER_A)).resolves.toEqual([
        { provider: 'openrouter', apiKey: FAKE_OPENROUTER_KEY },
      ]);
    });

    it('el code guardado gana al que venga en el cuerpo', async () => {
      const { service, calls } = createHarness(openRouterExchangeOk());

      const codeVerifierId = await startAndReturnFromBrowser(service);
      await service.completeOpenRouterPkce(USER_A, codeVerifierId, 'CODE-DEL-ATACANTE');

      const exchange = calls.find((call) => call.url === OPENROUTER_KEYS_URL)!;
      expect((exchange.body as { code: string }).code).toBe(FAKE_AUTH_CODE);
    });

    it('otro usuario no puede canjear el intento ajeno ni con el code guardado', async () => {
      const { service, calls, credentialsRepository } = createHarness(openRouterExchangeOk());

      const codeVerifierId = await startAndReturnFromBrowser(service);

      await expect(
        service.completeOpenRouterPkce(USER_B, codeVerifierId),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(calls).toHaveLength(0);
      expect(credentialsRepository.rows.size).toBe(0);
    });

    it('sin code guardado ni en el cuerpo responde 400 VALIDATION, no 403', async () => {
      const { service, calls } = createHarness(openRouterExchangeOk());

      const started = await service.startOpenRouterPkce(USER_A, DEFAULT_CALLBACK);

      const error = await service
        .completeOpenRouterPkce(USER_A, started.codeVerifierId)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe('VALIDATION');
      expect(calls).toHaveLength(0);
    });

    it('una entrada caducada entre el callback y el complete responde 403', async () => {
      const { service, redis } = createHarness(openRouterExchangeOk());

      const codeVerifierId = await startAndReturnFromBrowser(service);
      redis.store.clear();

      await expect(
        service.completeOpenRouterPkce(USER_A, codeVerifierId),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('POST /providers/gemini', () => {
    it('validates the key against /models and stores it encrypted', async () => {
      const { service, calls, credentialsRepository, credentialsService } = createHarness({
        [GEMINI_MODELS_URL]: () => jsonResponse({ data: [{ id: 'gemini-2.5-flash' }] }),
      });

      const status = await service.connectGemini(USER_A, FAKE_GEMINI_KEY);

      expect(status).toEqual({ provider: 'gemini', status: 'active', lastError: null });
      expect(calls[0]?.url).toBe(GEMINI_MODELS_URL);
      expect(calls[0]?.headers.Authorization).toBe(`Bearer ${FAKE_GEMINI_KEY}`);
      expect(JSON.stringify(credentialsRepository.rows.get(`${USER_A}:gemini`))).not.toContain(
        FAKE_GEMINI_KEY,
      );
      await expect(credentialsService.listActive(USER_A)).resolves.toEqual([
        { provider: 'gemini', apiKey: FAKE_GEMINI_KEY },
      ]);
    });

    it('rejects an invalid key with PROVIDER_KEY_INVALID and stores NOTHING', async () => {
      const { service, credentialsRepository } = createHarness({
        [GEMINI_MODELS_URL]: () => jsonResponse({ error: { code: 401 } }, 401),
      });

      await expect(service.connectGemini(USER_A, 'AIza-FAKE-invalida')).rejects.toMatchObject({
        code: 'PROVIDER_KEY_INVALID',
      });
      expect(credentialsRepository.rows.size).toBe(0);
      expect(credentialsRepository.save).not.toHaveBeenCalled();
    });

    it('treats a network failure as an invalid key (nothing stored)', async () => {
      const { service, credentialsRepository } = createHarness({
        [GEMINI_MODELS_URL]: () => {
          throw new Error('ECONNRESET');
        },
      });

      await expect(service.connectGemini(USER_A, FAKE_GEMINI_KEY)).rejects.toMatchObject({
        code: 'PROVIDER_KEY_INVALID',
      });
      expect(credentialsRepository.rows.size).toBe(0);
    });
  });

  describe('GET /providers/:provider/status', () => {
    it("returns 'not_connected' when the user never connected the provider", async () => {
      const { service } = createHarness({});

      await expect(service.getStatus(USER_A, 'gemini')).resolves.toEqual({
        provider: 'gemini',
        status: 'not_connected',
        lastError: null,
      });
    });

    it('maps {data:{total_credits,total_usage}} to credits {total, used}', async () => {
      const harness = createHarness({
        [GEMINI_MODELS_URL]: () => jsonResponse({ data: [] }),
        [OPENROUTER_CREDITS_URL]: () =>
          jsonResponse({ data: { total_credits: 12.5, total_usage: 3.25 } }),
      });
      await harness.credentialsService.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);

      const status = await harness.service.getStatus(USER_A, 'openrouter');

      expect(status).toEqual({
        provider: 'openrouter',
        status: 'active',
        lastError: null,
        credits: { total: 12.5, used: 3.25 },
      });
      const creditsCall = harness.calls.find((call) => call.url === OPENROUTER_CREDITS_URL)!;
      expect(creditsCall.headers.Authorization).toBe(`Bearer ${FAKE_OPENROUTER_KEY}`);
    });

    it('returns the status WITHOUT credits (not a 500) when the credits call fails', async () => {
      const harness = createHarness({
        [OPENROUTER_CREDITS_URL]: () => jsonResponse({ error: 'boom' }, 500),
      });
      await harness.credentialsService.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);

      await expect(harness.service.getStatus(USER_A, 'openrouter')).resolves.toEqual({
        provider: 'openrouter',
        status: 'active',
        lastError: null,
      });
    });

    it('returns the status without credits when the payload has an unexpected shape', async () => {
      const harness = createHarness({
        [OPENROUTER_CREDITS_URL]: () => jsonResponse({ data: { total_credits: 'mucho' } }),
      });
      await harness.credentialsService.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);

      const status = await harness.service.getStatus(USER_A, 'openrouter');

      expect(status.credits).toBeUndefined();
    });

    it("reports status 'error' with last_error and does not ask for credits", async () => {
      const harness = createHarness({});
      await harness.credentialsService.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
      await harness.credentialsService.markCredentialError(USER_A, 'openrouter', 'NO_CREDITS');

      await expect(harness.service.getStatus(USER_A, 'openrouter')).resolves.toEqual({
        provider: 'openrouter',
        status: 'error',
        lastError: 'NO_CREDITS',
      });
      expect(harness.calls).toHaveLength(0);
    });
  });

  describe('DELETE /providers/:provider', () => {
    it('deletes the credential and resets the model preferences that used it', async () => {
      const harness = createHarness({});
      await harness.credentialsService.saveApiKey(USER_A, 'gemini', FAKE_GEMINI_KEY);

      await harness.service.disconnect(USER_A, 'gemini');

      expect(harness.credentialsRepository.rows.size).toBe(0);
      expect(harness.modelPreferences.deleteIfUsesProvider).toHaveBeenCalledWith(USER_A, 'gemini');
      await expect(harness.credentialsService.listActive(USER_A)).resolves.toEqual([]);
    });

    it('is idempotent: disconnecting a provider that was never connected does not fail', async () => {
      const { service } = createHarness({});

      await expect(service.disconnect(USER_A, 'openrouter')).resolves.toBeUndefined();
    });
  });
});
