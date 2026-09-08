/**
 * Cifrado de credenciales de proveedor (SPEC-02 §5, RF-2.2).
 *
 * Módulo puro (`node:crypto`, sin NestJS) para poder testearlo sin arrancar
 * la aplicación:
 *
 * - AES-256-GCM con clave maestra de 32 bytes (`CREDENTIALS_MASTER_KEY`,
 *   base64).
 * - IV aleatorio de 12 bytes **por registro** (nunca se reutiliza).
 * - AAD = `${userId}:${provider}`: una fila cifrada para un usuario no se
 *   puede descifrar como si fuera de otro usuario o de otro proveedor,
 *   aunque alguien la mueva de sitio en la tabla.
 * - Tag de autenticación de 16 bytes, guardado aparte (`key_tag`).
 *
 * Invariante de seguridad: la key en claro solo existe como valor de retorno
 * de `decryptSecret`, en memoria. Ninguna función de este módulo la registra,
 * la serializa ni la incluye en el mensaje de un error.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Provider } from '../db/schema.js';

const ALGORITHM = 'aes-256-gcm';

/** AES-256: la clave maestra mide exactamente 32 bytes. */
export const MASTER_KEY_BYTES = 32;
/** SPEC-02 §5: IV aleatorio de 12 bytes por registro. */
export const IV_BYTES = 12;
/** SPEC-01 §2.4: `key_tag` de 16 bytes. */
export const TAG_BYTES = 16;

/** Las tres columnas `bytea` de `provider_credentials` (SPEC-01 §2.4). */
export interface EncryptedSecret {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly tag: Buffer;
}

/**
 * Decodifica una clave maestra en base64 y valida que mida 32 bytes.
 *
 * Se llama en el constructor de `CredentialsService`, así que una clave mal
 * formada rompe el arranque de la API con un mensaje claro en vez de fallar
 * a la primera credencial que alguien intente guardar. El mensaje nunca
 * incluye el valor de la clave.
 */
export function decodeMasterKey(raw: string, variableName: string): Buffer {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.byteLength !== MASTER_KEY_BYTES) {
    throw new Error(
      `${variableName} debe ser base64 de exactamente ${MASTER_KEY_BYTES} bytes ` +
        `(AES-256-GCM); la clave decodificada mide ${key.byteLength} bytes.`,
    );
  }
  return key;
}

/** AAD de una credencial (SPEC-02 §5): `user_id:provider`. */
export function credentialAad(userId: string, provider: Provider): string {
  return `${userId}:${provider}`;
}

/** Cifra un secreto con la clave maestra **actual**. */
export function encryptSecret(
  masterKey: Buffer,
  plaintext: string,
  aad: string,
): EncryptedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

/**
 * Descifra un secreto probando las claves maestras **en orden**: primero la
 * actual y, si falla, la anterior (`CREDENTIALS_MASTER_KEY_PREVIOUS`), que es
 * lo que permite rotar la clave sin recifrar todas las filas a la vez
 * (SPEC-02 §5).
 *
 * Lanza si ninguna clave sirve (clave equivocada, AAD equivocado —otro
 * usuario u otro proveedor—, o datos manipulados: GCM no distingue esos
 * casos). El mensaje del error nunca contiene el secreto ni la clave.
 */
export function decryptSecret(
  masterKeys: readonly Buffer[],
  secret: EncryptedSecret,
  aad: string,
): string {
  for (const masterKey of masterKeys) {
    try {
      const decipher = createDecipheriv(ALGORITHM, masterKey, secret.iv, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(secret.tag);
      return Buffer.concat([
        decipher.update(secret.ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Se prueba la siguiente clave. No se registra nada: el motivo del
      // fallo (clave o AAD) no aporta y el error de OpenSSL tampoco.
    }
  }

  throw new Error(
    'No se pudo descifrar la credencial: ninguna clave maestra la valida ' +
      '(clave rotada sin CREDENTIALS_MASTER_KEY_PREVIOUS, o fila alterada).',
  );
}

/**
 * Serializa un `Buffer` al formato en el que PostgREST acepta y devuelve las
 * columnas `bytea`: el string `\x<hex>` (verificado contra la rama de
 * InsForge con un INSERT + SELECT real sobre `provider_credentials`).
 */
export function toByteaHex(value: Buffer): string {
  return `\\x${value.toString('hex')}`;
}

/** Inverso de `toByteaHex`. Tolera que falte el prefijo `\x`. */
export function fromByteaHex(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ''), 'hex');
}
