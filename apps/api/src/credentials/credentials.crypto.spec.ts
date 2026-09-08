import { createCipheriv, randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Provider } from '../db/schema.js';
import {
  credentialAad,
  CredentialDecryptError,
  CredentialsCrypto,
  decodeBytea,
  decodeMasterKey,
  decryptSecret,
  encryptSecret,
  type EncryptedCredential,
  IV_BYTES,
  MASTER_KEY_BYTES,
  TAG_BYTES,
  toByteaHex,
} from './credentials.crypto.js';

/** Clave de juguete, generada en el propio test. Nunca una clave real. */
function fakeMasterKey(): Buffer {
  return randomBytes(MASTER_KEY_BYTES);
}

/** Valor obviamente falso: ninguna key real de proveedor entra en los tests. */
const FAKE_API_KEY = 'sk-or-v1-FAKE-not-a-real-key-0123456789';
const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('decodeMasterKey', () => {
  it('accepts a base64 key of exactly 32 bytes', () => {
    const raw = fakeMasterKey().toString('base64');
    expect(decodeMasterKey(raw, 'CREDENTIALS_MASTER_KEY')).toHaveLength(MASTER_KEY_BYTES);
  });

  it('rejects a key that is not 32 bytes, naming the variable', () => {
    const raw = randomBytes(16).toString('base64');
    expect(() => decodeMasterKey(raw, 'CREDENTIALS_MASTER_KEY')).toThrow(
      /CREDENTIALS_MASTER_KEY.*32 bytes/s,
    );
  });

  it('rejects garbage that does not decode to 32 bytes', () => {
    expect(() => decodeMasterKey('no-es-base64-de-32-bytes', 'CREDENTIALS_MASTER_KEY')).toThrow();
  });
});

describe('encryptSecret / decryptSecret (AES-256-GCM, SPEC-02 §5)', () => {
  it('round trip: decrypting returns the exact same key', () => {
    const masterKey = fakeMasterKey();
    const aad = credentialAad(USER_ID, 'openrouter');

    const secret = encryptSecret(masterKey, FAKE_API_KEY, aad);

    expect(decryptSecret([masterKey], secret, aad)).toBe(FAKE_API_KEY);
  });

  it('uses a 12-byte IV and a 16-byte tag, and never stores the plaintext', () => {
    const masterKey = fakeMasterKey();
    const secret = encryptSecret(masterKey, FAKE_API_KEY, credentialAad(USER_ID, 'gemini'));

    expect(secret.iv).toHaveLength(IV_BYTES);
    expect(secret.tag).toHaveLength(TAG_BYTES);
    expect(secret.ciphertext.toString('utf8')).not.toContain(FAKE_API_KEY);
    expect(secret.ciphertext.toString('hex')).not.toContain(
      Buffer.from(FAKE_API_KEY, 'utf8').toString('hex'),
    );
  });

  it('uses a different IV (and ciphertext) on every encryption of the same text', () => {
    const masterKey = fakeMasterKey();
    const aad = credentialAad(USER_ID, 'openrouter');

    const ivs = new Set<string>();
    const ciphertexts = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const secret = encryptSecret(masterKey, FAKE_API_KEY, aad);
      ivs.add(secret.iv.toString('hex'));
      ciphertexts.add(secret.ciphertext.toString('hex'));
    }

    expect(ivs.size).toBe(25);
    expect(ciphertexts.size).toBe(25);
  });

  it('fails when the AAD belongs to another user', () => {
    const masterKey = fakeMasterKey();
    const secret = encryptSecret(
      masterKey,
      FAKE_API_KEY,
      credentialAad(USER_ID, 'openrouter'),
    );

    expect(() =>
      decryptSecret(
        [masterKey],
        secret,
        credentialAad('22222222-2222-4222-8222-222222222222', 'openrouter'),
      ),
    ).toThrow(/No se pudo descifrar/);
  });

  it('fails when the AAD belongs to another provider', () => {
    const masterKey = fakeMasterKey();
    const secret = encryptSecret(
      masterKey,
      FAKE_API_KEY,
      credentialAad(USER_ID, 'openrouter'),
    );

    expect(() => decryptSecret([masterKey], secret, credentialAad(USER_ID, 'gemini'))).toThrow(
      /No se pudo descifrar/,
    );
  });

  it('fails when the ciphertext or the tag were tampered with', () => {
    const masterKey = fakeMasterKey();
    const aad = credentialAad(USER_ID, 'openrouter');
    const secret = encryptSecret(masterKey, FAKE_API_KEY, aad);

    const tampered = Buffer.from(secret.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;

    expect(() => decryptSecret([masterKey], { ...secret, ciphertext: tampered }, aad)).toThrow();
  });

  it('rotation: a secret encrypted with the previous key still decrypts when it is provided', () => {
    const previousKey = fakeMasterKey();
    const currentKey = fakeMasterKey();
    const aad = credentialAad(USER_ID, 'gemini');

    const secret = encryptSecret(previousKey, FAKE_API_KEY, aad);

    // Con la clave anterior configurada: se descifra.
    expect(decryptSecret([currentKey, previousKey], secret, aad)).toBe(FAKE_API_KEY);
    // Sin ella: falla.
    expect(() => decryptSecret([currentKey], secret, aad)).toThrow(/No se pudo descifrar/);
  });

  it('never leaks the plaintext key in the error message', () => {
    const masterKey = fakeMasterKey();
    const secret = encryptSecret(masterKey, FAKE_API_KEY, credentialAad(USER_ID, 'openrouter'));

    let message = '';
    try {
      decryptSecret([fakeMasterKey()], secret, credentialAad(USER_ID, 'openrouter'));
    } catch (error) {
      message = (error as Error).stack ?? (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(FAKE_API_KEY);
    expect(message).not.toContain(masterKey.toString('base64'));
  });
});

describe('toByteaHex / decodeBytea (formato bytea de PostgREST)', () => {
  it('serializes to the \\x<hex> string that PostgREST accepts and returns', () => {
    expect(toByteaHex(Buffer.from([0x07, 0x07, 0xff]))).toBe('\\x0707ff');
  });

  it('round trips any buffer', () => {
    const value = randomBytes(48);
    expect(decodeBytea(toByteaHex(value)).equals(value)).toBe(true);
  });

  it('tolerates a value without the \\x prefix', () => {
    expect(decodeBytea('0707ff').equals(Buffer.from([0x07, 0x07, 0xff]))).toBe(true);
  });

  // Casos heredados de `src/crypto/credentials-cipher.spec.ts` (PR-05), que
  // se borró al unificar el cifrado (PEND-72).
  it('decodifica el formato hex de salida de Postgres', () => {
    expect(decodeBytea('\\x48656c6c6f').toString('utf8')).toBe('Hello');
  });

  it('cae a base64 cuando el valor no es hex', () => {
    expect(decodeBytea('SGVsbG8sIHdvcmxk').toString('utf8')).toBe('Hello, world');
  });
});

/**
 * Casos heredados de `src/crypto/credentials-cipher.spec.ts` (PR-05): la
 * clase `CredentialsCipher` que solo descifraba se borró al fusionar, y su
 * cobertura vive aquí sobre `CredentialsCrypto`, que cifra y descifra.
 */
describe('CredentialsCrypto', () => {
  const CURRENT_KEY = fakeMasterKey();
  const PREVIOUS_KEY = fakeMasterKey();
  const OTHER_KEY = fakeMasterKey();
  const PROVIDER: Provider = 'openrouter';

  function cryptoWith(current: Buffer, previous?: Buffer): CredentialsCrypto {
    const values: Record<string, string | undefined> = {
      CREDENTIALS_MASTER_KEY: current.toString('base64'),
      CREDENTIALS_MASTER_KEY_PREVIOUS: previous?.toString('base64'),
    };
    const configService = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    return new CredentialsCrypto(configService as never);
  }

  /** Cifrado de referencia, para poder fabricar filas en base64 también. */
  function encryptRow(
    masterKey: Buffer,
    userId: string,
    provider: Provider,
    plaintext: string,
    encoding: 'bytea-hex' | 'base64' = 'bytea-hex',
  ): EncryptedCredential {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    cipher.setAAD(Buffer.from(credentialAad(userId, provider), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const encode = (buffer: Buffer): string =>
      encoding === 'base64' ? buffer.toString('base64') : toByteaHex(buffer);

    return {
      key_ciphertext: encode(ciphertext),
      key_iv: encode(iv),
      key_tag: encode(cipher.getAuthTag()),
    };
  }

  it('round-trip: lo que cifra lo descifra', () => {
    const crypto = cryptoWith(CURRENT_KEY);
    const row = crypto.encrypt(USER_ID, PROVIDER, FAKE_API_KEY);

    expect(row.key_ciphertext).toMatch(/^\\x[0-9a-f]+$/);
    expect(crypto.decrypt(USER_ID, PROVIDER, row)).toBe(FAKE_API_KEY);
  });

  it('descifra registros escritos en base64', () => {
    const row = encryptRow(CURRENT_KEY, USER_ID, PROVIDER, FAKE_API_KEY, 'base64');

    expect(cryptoWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, row)).toBe(FAKE_API_KEY);
  });

  it('descifra con CREDENTIALS_MASTER_KEY_PREVIOUS durante una rotación', () => {
    const row = encryptRow(PREVIOUS_KEY, USER_ID, PROVIDER, FAKE_API_KEY);

    expect(cryptoWith(CURRENT_KEY, PREVIOUS_KEY).decrypt(USER_ID, PROVIDER, row)).toBe(
      FAKE_API_KEY,
    );
  });

  it('falla si ninguna de las dos claves autentica el registro', () => {
    const row = encryptRow(OTHER_KEY, USER_ID, PROVIDER, FAKE_API_KEY);

    expect(() =>
      cryptoWith(CURRENT_KEY, PREVIOUS_KEY).decrypt(USER_ID, PROVIDER, row),
    ).toThrow(CredentialDecryptError);
  });

  it('falla si el AAD no corresponde al usuario (SPEC-02 §5)', () => {
    const row = encryptRow(CURRENT_KEY, USER_ID, PROVIDER, FAKE_API_KEY);

    expect(() =>
      cryptoWith(CURRENT_KEY).decrypt(
        '00000000-0000-0000-0000-000000000000',
        PROVIDER,
        row,
      ),
    ).toThrow(CredentialDecryptError);
  });

  it('falla si el AAD no corresponde al proveedor', () => {
    const row = encryptRow(CURRENT_KEY, USER_ID, PROVIDER, FAKE_API_KEY);

    expect(() => cryptoWith(CURRENT_KEY).decrypt(USER_ID, 'gemini', row)).toThrow(
      CredentialDecryptError,
    );
  });

  it('rechaza un IV que no tiene 12 bytes', () => {
    const row = encryptRow(CURRENT_KEY, USER_ID, PROVIDER, FAKE_API_KEY);
    const corrupted = { ...row, key_iv: '\\x0102030405' };

    expect(() => cryptoWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, corrupted)).toThrow(
      /IV inválido/,
    );
  });

  it('rechaza un tag que no tiene 16 bytes', () => {
    const row = encryptRow(CURRENT_KEY, USER_ID, PROVIDER, FAKE_API_KEY);
    const corrupted = { ...row, key_tag: '\\x0102030405' };

    expect(() => cryptoWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, corrupted)).toThrow(
      /Tag inválido/,
    );
  });

  it('rechaza en el constructor una clave maestra que no tiene 32 bytes', () => {
    expect(() => cryptoWith(randomBytes(16))).toThrow(/CREDENTIALS_MASTER_KEY/);
  });

  it('no filtra ni el secreto ni la clave en el mensaje de error', () => {
    const row = encryptRow(OTHER_KEY, USER_ID, PROVIDER, FAKE_API_KEY);

    try {
      cryptoWith(CURRENT_KEY).decrypt(USER_ID, PROVIDER, row);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(FAKE_API_KEY);
      expect(message).not.toContain(CURRENT_KEY.toString('base64'));
    }
  });
});
