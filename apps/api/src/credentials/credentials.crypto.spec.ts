import { randomBytes } from 'node:crypto';
import {
  credentialAad,
  decodeMasterKey,
  decryptSecret,
  encryptSecret,
  fromByteaHex,
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

describe('toByteaHex / fromByteaHex (formato bytea de PostgREST)', () => {
  it('serializes to the \\x<hex> string that PostgREST accepts and returns', () => {
    expect(toByteaHex(Buffer.from([0x07, 0x07, 0xff]))).toBe('\\x0707ff');
  });

  it('round trips any buffer', () => {
    const value = randomBytes(48);
    expect(fromByteaHex(toByteaHex(value)).equals(value)).toBe(true);
  });

  it('tolerates a value without the \\x prefix', () => {
    expect(fromByteaHex('0707ff').equals(Buffer.from([0x07, 0x07, 0xff]))).toBe(true);
  });
});
