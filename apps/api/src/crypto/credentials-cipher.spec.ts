import { randomBytes, createCipheriv } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';

import {
  CredentialDecryptError,
  CredentialsCipher,
  credentialAad,
  decodeBytea,
  type EncryptedCredential,
} from './credentials-cipher.js';

const USER_ID = '9595625c-aea8-4120-accc-ed149d0a84c6';
const PROVIDER = 'openrouter';

const CURRENT_KEY = randomBytes(32);
const PREVIOUS_KEY = randomBytes(32);
const OTHER_KEY = randomBytes(32);

/**
 * Cifrado de referencia según SPEC-02 §5. Vive solo en el test: la clase de
 * producción únicamente descifra.
 */
function encrypt(
  masterKey: Buffer,
  userId: string,
  provider: string,
  plaintext: string,
  encoding: 'bytea-hex' | 'base64' = 'bytea-hex',
): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  cipher.setAAD(credentialAad(userId, provider));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encode = (buffer: Buffer): string =>
    encoding === 'base64'
      ? buffer.toString('base64')
      : `\\x${buffer.toString('hex')}`;

  return {
    key_ciphertext: encode(ciphertext),
    key_iv: encode(iv),
    key_tag: encode(tag),
  };
}

function cipherWith(current: Buffer, previous?: Buffer): CredentialsCipher {
  const values: Record<string, string | undefined> = {
    CREDENTIALS_MASTER_KEY: current.toString('base64'),
    CREDENTIALS_MASTER_KEY_PREVIOUS: previous?.toString('base64'),
  };
  const configService = {
    get: (key: string) => values[key],
  } as unknown as ConfigService<Record<string, unknown>, true>;
  return new CredentialsCipher(configService as never);
}

describe('decodeBytea', () => {
  it('decodifica el formato hex de salida de Postgres', () => {
    expect(decodeBytea('\\x48656c6c6f').toString('utf8')).toBe('Hello');
  });

  it('decodifica hex sin prefijo', () => {
    expect(decodeBytea('48656c6c6f').toString('utf8')).toBe('Hello');
  });

  it('cae a base64 cuando no es hex', () => {
    expect(decodeBytea('SGVsbG8sIHdvcmxk').toString('utf8')).toBe('Hello, world');
  });
});

describe('CredentialsCipher', () => {
  it('descifra con la clave actual (round-trip)', () => {
    const secret = 'sk-or-v1-clave-de-prueba';
    const record = encrypt(CURRENT_KEY, USER_ID, PROVIDER, secret);

    expect(cipherWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, record)).toBe(secret);
  });

  it('descifra registros escritos en base64', () => {
    const secret = 'sk-or-v1-base64';
    const record = encrypt(CURRENT_KEY, USER_ID, PROVIDER, secret, 'base64');

    expect(cipherWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, record)).toBe(secret);
  });

  it('descifra con CREDENTIALS_MASTER_KEY_PREVIOUS durante una rotación', () => {
    const secret = 'sk-or-v1-cifrada-antes-de-rotar';
    const record = encrypt(PREVIOUS_KEY, USER_ID, PROVIDER, secret);

    expect(cipherWith(CURRENT_KEY, PREVIOUS_KEY).decrypt(USER_ID, PROVIDER, record)).toBe(
      secret,
    );
  });

  it('falla si ninguna de las dos claves autentica el registro', () => {
    const record = encrypt(OTHER_KEY, USER_ID, PROVIDER, 'sk-or-v1-otra-clave');

    expect(() =>
      cipherWith(CURRENT_KEY, PREVIOUS_KEY).decrypt(USER_ID, PROVIDER, record),
    ).toThrow(CredentialDecryptError);
  });

  it('falla si el AAD no corresponde al usuario (SPEC-02 §5)', () => {
    const record = encrypt(CURRENT_KEY, USER_ID, PROVIDER, 'sk-or-v1-de-otro');

    expect(() =>
      cipherWith(CURRENT_KEY).decrypt(
        '00000000-0000-0000-0000-000000000000',
        PROVIDER,
        record,
      ),
    ).toThrow(CredentialDecryptError);
  });

  it('falla si el AAD no corresponde al proveedor', () => {
    const record = encrypt(CURRENT_KEY, USER_ID, PROVIDER, 'sk-or-v1-de-openrouter');

    expect(() => cipherWith(CURRENT_KEY).decrypt(USER_ID, 'gemini', record)).toThrow(
      CredentialDecryptError,
    );
  });

  it('rechaza un IV que no tiene 12 bytes', () => {
    const record = encrypt(CURRENT_KEY, USER_ID, PROVIDER, 'sk-or-v1-iv-corto');
    const corrupted = { ...record, key_iv: '\\x0102030405' };

    expect(() => cipherWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, corrupted)).toThrow(
      /IV inválido/,
    );
  });

  it('rechaza una clave maestra que no tiene 32 bytes', () => {
    expect(() => cipherWith(randomBytes(16))).toThrow(/CREDENTIALS_MASTER_KEY/);
  });

  it('no filtra la clave en el mensaje de error', () => {
    const secret = 'sk-or-v1-supersecreta';
    const record = encrypt(OTHER_KEY, USER_ID, PROVIDER, secret);

    try {
      cipherWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, record);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain(CURRENT_KEY.toString('base64'));
    }
  });
});
