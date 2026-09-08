import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { Provider, ProviderCredential } from '../db/schema.js';
import { fromByteaHex, MASTER_KEY_BYTES } from './credentials.crypto.js';
import type { CredentialRowInput, CredentialsRepository } from './credentials.repository.js';
import { CredentialsService } from './credentials.service.js';

/** Claves de juguete, generadas en el test. Nunca claves reales. */
function fakeMasterKeyBase64(): string {
  return randomBytes(MASTER_KEY_BYTES).toString('base64');
}

/** Valores obviamente falsos: ninguna key real de proveedor entra en los tests. */
const FAKE_OPENROUTER_KEY = 'sk-or-v1-FAKE-openrouter-key-0123456789';
const FAKE_GEMINI_KEY = 'AIza-FAKE-gemini-key-0123456789';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

/**
 * Doble en memoria de `CredentialsRepository`: guarda exactamente lo que
 * guardaría PostgREST (las tres columnas `bytea` como el string `\x<hex>`),
 * para poder inspeccionar qué acaba en la base de datos.
 */
function createFakeRepository() {
  const rows = new Map<string, ProviderCredential>();
  const keyOf = (userId: string, provider: Provider) => `${userId}:${provider}`;

  const repository = {
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

  return repository;
}

function createConfig(current: string, previous?: string): ConfigService<Env, true> {
  const values: Record<string, unknown> = {
    CREDENTIALS_MASTER_KEY: current,
    CREDENTIALS_MASTER_KEY_PREVIOUS: previous,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function createService(
  repository: ReturnType<typeof createFakeRepository>,
  current: string,
  previous?: string,
) {
  return new CredentialsService(
    createConfig(current, previous),
    repository as unknown as CredentialsRepository,
  );
}

describe('CredentialsService', () => {
  let loggedMessages: string[];

  beforeEach(() => {
    loggedMessages = [];
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation((message: unknown) => {
        loggedMessages.push(String(message));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails at construction time when the master key is not 32 bytes', () => {
    const repository = createFakeRepository();
    expect(() => createService(repository, randomBytes(16).toString('base64'))).toThrow(
      /CREDENTIALS_MASTER_KEY.*32 bytes/s,
    );
  });

  it('fails at construction time when the previous key is malformed', () => {
    const repository = createFakeRepository();
    expect(() =>
      createService(repository, fakeMasterKeyBase64(), randomBytes(31).toString('base64')),
    ).toThrow(/CREDENTIALS_MASTER_KEY_PREVIOUS/);
  });

  it('round trip: saveApiKey + listActive returns the exact key', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    await service.saveApiKey(USER_A, 'gemini', FAKE_GEMINI_KEY);

    const active = await service.listActive(USER_A);

    expect(active).toEqual(
      expect.arrayContaining([
        { provider: 'openrouter', apiKey: FAKE_OPENROUTER_KEY },
        { provider: 'gemini', apiKey: FAKE_GEMINI_KEY },
      ]),
    );
  });

  it('stores the key encrypted, with a 12-byte IV and a 16-byte tag in \\x<hex>', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    const row = repository.rows.get(`${USER_A}:openrouter`)!;

    expect(row.key_ciphertext).toMatch(/^\\x[0-9a-f]+$/);
    expect(fromByteaHex(row.key_iv)).toHaveLength(12);
    expect(fromByteaHex(row.key_tag)).toHaveLength(16);
    expect(JSON.stringify(row)).not.toContain(FAKE_OPENROUTER_KEY);
  });

  it('uses a different IV on every save of the same key', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    const first = repository.rows.get(`${USER_A}:openrouter`)!;
    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    const second = repository.rows.get(`${USER_A}:openrouter`)!;

    expect(second.key_iv).not.toBe(first.key_iv);
    expect(second.key_ciphertext).not.toBe(first.key_ciphertext);
  });

  it('skips (and never leaks) a row whose AAD belongs to another user', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);

    // Alguien mueve la fila de A a B: el AAD (`user_id:provider`) ya no cuadra.
    const moved = { ...repository.rows.get(`${USER_A}:openrouter`)!, user_id: USER_B };
    repository.rows.set(`${USER_B}:openrouter`, moved);

    await expect(service.listActive(USER_B)).resolves.toEqual([]);
    expect(loggedMessages.join('\n')).toContain('No se pudo descifrar');
    expect(loggedMessages.join('\n')).not.toContain(FAKE_OPENROUTER_KEY);
  });

  it('rotation: a key encrypted with the previous master key still decrypts, and stops when it is removed', async () => {
    const previous = fakeMasterKeyBase64();
    const current = fakeMasterKeyBase64();
    const repository = createFakeRepository();

    // Se guardó cuando `previous` era la clave actual.
    await createService(repository, previous).saveApiKey(
      USER_A,
      'openrouter',
      FAKE_OPENROUTER_KEY,
    );

    // Tras rotar, con CREDENTIALS_MASTER_KEY_PREVIOUS puesta: sigue funcionando.
    await expect(createService(repository, current, previous).listActive(USER_A)).resolves.toEqual(
      [{ provider: 'openrouter', apiKey: FAKE_OPENROUTER_KEY }],
    );

    // Sin la clave anterior: la fila se ignora (con warn), no se rompe la petición.
    await expect(createService(repository, current).listActive(USER_A)).resolves.toEqual([]);
  });

  it('always encrypts with the CURRENT key, even when a previous one is configured', async () => {
    const previous = fakeMasterKeyBase64();
    const current = fakeMasterKeyBase64();
    const repository = createFakeRepository();

    await createService(repository, current, previous).saveApiKey(
      USER_A,
      'gemini',
      FAKE_GEMINI_KEY,
    );

    // Un servicio con solo la clave actual lo lee: se cifró con ella.
    await expect(createService(repository, current).listActive(USER_A)).resolves.toEqual([
      { provider: 'gemini', apiKey: FAKE_GEMINI_KEY },
    ]);
  });

  it('listActive only returns credentials with status = active', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    await service.markCredentialError(USER_A, 'openrouter', 'NO_CREDITS');

    await expect(service.listActive(USER_A)).resolves.toEqual([]);
    await expect(service.getActiveApiKey(USER_A, 'openrouter')).resolves.toBeNull();
    expect(repository.rows.get(`${USER_A}:openrouter`)).toMatchObject({
      status: 'error',
      last_error: 'NO_CREDITS',
    });
  });

  it('never logs or serializes the plaintext key', async () => {
    const repository = createFakeRepository();
    const service = createService(repository, fakeMasterKeyBase64());

    await service.saveApiKey(USER_A, 'openrouter', FAKE_OPENROUTER_KEY);
    await service.listActive(USER_A);
    await service.getActiveApiKey(USER_A, 'openrouter');
    await service.remove(USER_A, 'openrouter');

    expect(loggedMessages.join('\n')).not.toContain(FAKE_OPENROUTER_KEY);
    // Ni el servicio ni lo persistido llevan la key en claro.
    expect(JSON.stringify(service)).not.toContain(FAKE_OPENROUTER_KEY);
    expect(JSON.stringify([...repository.rows.values()])).not.toContain(FAKE_OPENROUTER_KEY);
  });
});
