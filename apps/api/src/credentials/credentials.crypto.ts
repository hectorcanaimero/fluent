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
 *
 * Es la **única** implementación de cifrado de credenciales del repo: al
 * fusionar PR-05 se borró `src/crypto/credentials-cipher.ts` (que solo
 * descifraba) y sus consumidores —los jobs `coaching-brief` y
 * `weekly-summary`— pasaron a inyectar `CredentialsCrypto`, la clase de Nest
 * que hay al final de este archivo. De ahí vienen tres cosas que la versión
 * pura de PR-02 no tenía y que se conservaron: el error tipado
 * `CredentialDecryptError`, la validación de longitud de IV y tag, y
 * `decodeBytea`, que acepta también base64 además del `\x<hex>` de PostgREST.
 * Ver docs/specs/pendientes/PR-02.md PEND-72.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
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

/**
 * Inverso de `toByteaHex`.
 *
 * Acepta las tres formas en que puede llegar una columna `bytea`:
 * el formato de salida hex de Postgres (`\x0a1b…`), hex sin prefijo, y
 * base64 —por si la fila la escribió otro cliente (PEND-03 de
 * docs/specs/pendientes/PR-05.md)—. El prefijo `\x` y la comprobación de hex
 * puro distinguen los casos sin ambigüedad práctica.
 */
export function decodeBytea(value: string): Buffer {
  const trimmed = value.trim();
  if (trimmed.startsWith('\\x') || trimmed.startsWith('\\X')) {
    return Buffer.from(trimmed.slice(2), 'hex');
  }
  if (trimmed.length % 2 === 0 && /^[0-9a-f]+$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'base64');
}

/**
 * Error tipado de descifrado, para que quien llame pueda distinguir "esta
 * credencial no se puede leer" de cualquier otro fallo sin mirar el mensaje.
 * Su mensaje nunca contiene el secreto ni el material de clave.
 */
export class CredentialDecryptError extends Error {
  override readonly name = 'CredentialDecryptError';
  readonly code = 'CREDENTIAL_DECRYPT_FAILED';
}

/** Las tres columnas `bytea` tal y como las devuelve PostgREST (strings). */
export interface EncryptedCredential {
  readonly key_ciphertext: string;
  readonly key_iv: string;
  readonly key_tag: string;
}

/**
 * Cifrado de credenciales como servicio de Nest: lee las claves maestras de
 * la configuración una sola vez (el arranque falla si `CREDENTIALS_MASTER_KEY`
 * no es base64 de 32 bytes) y expone el par cifrar/descifrar sobre las
 * columnas `bytea` de `provider_credentials`.
 *
 * Lo inyectan `CredentialsService` (API) y los jobs `coaching-brief` y
 * `weekly-summary` (PR-05), que solo descifran filas que ya cargaron.
 */
@Injectable()
export class CredentialsCrypto {
  /** Clave con la que se **cifra** siempre (la actual). */
  private readonly currentKey: Buffer;
  /**
   * Claves con las que se intenta **descifrar**, en orden: la actual y, si
   * está configurada, la anterior (`CREDENTIALS_MASTER_KEY_PREVIOUS`), que es
   * lo que permite rotar sin recifrar todas las filas de golpe (SPEC-02 §5).
   */
  private readonly decryptionKeys: readonly Buffer[];

  constructor(configService: ConfigService<Env, true>) {
    this.currentKey = decodeMasterKey(
      configService.get('CREDENTIALS_MASTER_KEY', { infer: true }),
      'CREDENTIALS_MASTER_KEY',
    );

    const previousRaw = configService.get('CREDENTIALS_MASTER_KEY_PREVIOUS', {
      infer: true,
    });
    const previousKey = previousRaw
      ? decodeMasterKey(previousRaw, 'CREDENTIALS_MASTER_KEY_PREVIOUS')
      : null;

    this.decryptionKeys = previousKey ? [this.currentKey, previousKey] : [this.currentKey];
  }

  /** Cifra `apiKey` con la clave actual y devuelve las tres columnas en `\x<hex>`. */
  encrypt(userId: string, provider: Provider, apiKey: string): EncryptedCredential {
    const secret = encryptSecret(this.currentKey, apiKey, credentialAad(userId, provider));

    return {
      key_ciphertext: toByteaHex(secret.ciphertext),
      key_iv: toByteaHex(secret.iv),
      key_tag: toByteaHex(secret.tag),
    };
  }

  /**
   * Devuelve la API key en claro de una fila de `provider_credentials`.
   *
   * Lanza `CredentialDecryptError` si el IV o el tag no miden lo que deben, o
   * si ninguna de las claves maestras autentica el registro (clave rotada dos
   * veces, fila alterada, o AAD que no corresponde a ese usuario/proveedor:
   * AES-GCM no distingue esos casos).
   */
  decrypt(userId: string, provider: Provider, credential: EncryptedCredential): string {
    const ciphertext = decodeBytea(credential.key_ciphertext);
    const iv = decodeBytea(credential.key_iv);
    const tag = decodeBytea(credential.key_tag);

    if (iv.byteLength !== IV_BYTES) {
      throw new CredentialDecryptError(
        `IV inválido: se esperaban ${IV_BYTES} bytes, hay ${iv.byteLength}`,
      );
    }
    if (tag.byteLength !== TAG_BYTES) {
      throw new CredentialDecryptError(
        `Tag inválido: se esperaban ${TAG_BYTES} bytes, hay ${tag.byteLength}`,
      );
    }

    try {
      return decryptSecret(
        this.decryptionKeys,
        { ciphertext, iv, tag },
        credentialAad(userId, provider),
      );
    } catch {
      // El error de `decryptSecret` no aporta nada que no diga este: se
      // sustituye por el tipado, sin encadenar la causa (que no lleva
      // secretos, pero tampoco información útil).
      throw new CredentialDecryptError(
        `No se pudo descifrar la credencial de ${provider}`,
      );
    }
  }
}
