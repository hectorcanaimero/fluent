/**
 * Descifrado de `provider_credentials` (SPEC-02 §5).
 *
 * AES-256-GCM, IV aleatorio de 12 bytes por registro, AAD = `user_id:provider`,
 * clave maestra `CREDENTIALS_MASTER_KEY` (32 bytes en base64). Si el descifrado
 * falla con la clave actual se reintenta con `CREDENTIALS_MASTER_KEY_PREVIOUS`,
 * para que una rotación de clave no deje al usuario sin credenciales mientras el
 * job de recifrado no haya pasado.
 *
 * Solo descifra: este PR nunca escribe credenciales.
 *
 * AVISO (PEND-02 de docs/specs/pendientes/PR-05.md): PR-02/T4 implementará un
 * `CredentialsService` con esta misma lógica más el cifrado. Cuando PR-02 se
 * fusione hay que quedarse con una sola implementación.
 *
 * Invariante de seguridad: la clave descifrada solo vive en memoria y nunca se
 * registra. Los errores no incluyen ni el texto plano ni el material de clave.
 */
import { createDecipheriv } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

/** Longitudes fijas de SPEC-02 §5. */
export const MASTER_KEY_BYTES = 32;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;

/** Columnas cifradas de `provider_credentials` tal y como las devuelve PostgREST. */
export interface EncryptedCredential {
  readonly key_ciphertext: string;
  readonly key_iv: string;
  readonly key_tag: string;
}

export class CredentialDecryptError extends Error {
  readonly name = 'CredentialDecryptError';
  readonly code = 'CREDENTIAL_DECRYPT_FAILED';
}

/**
 * PostgREST serializa `bytea` en el formato de salida hex de Postgres
 * (`\x0a1b2c…`). Se acepta también base64 por si la fila se escribió desde
 * otro cliente (ver PEND-03): el prefijo `\x` y la comprobación de hex puro
 * distinguen ambos casos sin ambigüedad práctica.
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

function parseMasterKey(raw: string, label: string): Buffer {
  const key = Buffer.from(raw, 'base64');
  if (key.length !== MASTER_KEY_BYTES) {
    throw new Error(
      `${label} debe ser ${MASTER_KEY_BYTES} bytes en base64 (recibidos ${key.length})`,
    );
  }
  return key;
}

/** AAD de SPEC-02 §5: liga el registro a su dueño y a su proveedor. */
export function credentialAad(userId: string, provider: string): Buffer {
  return Buffer.from(`${userId}:${provider}`, 'utf8');
}

function decryptWithKey(
  masterKey: Buffer,
  aad: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  tag: Buffer,
): string {
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

@Injectable()
export class CredentialsCipher {
  private readonly masterKey: Buffer;
  private readonly previousMasterKey: Buffer | null;

  constructor(configService: ConfigService<Env, true>) {
    this.masterKey = parseMasterKey(
      configService.get('CREDENTIALS_MASTER_KEY', { infer: true }),
      'CREDENTIALS_MASTER_KEY',
    );
    const previous = configService.get('CREDENTIALS_MASTER_KEY_PREVIOUS', {
      infer: true,
    });
    this.previousMasterKey = previous
      ? parseMasterKey(previous, 'CREDENTIALS_MASTER_KEY_PREVIOUS')
      : null;
  }

  /**
   * Devuelve la API key en claro. Lanza `CredentialDecryptError` si ninguna de
   * las dos claves maestras autentica el registro (clave rotada dos veces,
   * fila corrupta o AAD que no corresponde a ese usuario/proveedor).
   */
  decrypt(
    userId: string,
    provider: string,
    credential: EncryptedCredential,
  ): string {
    const ciphertext = decodeBytea(credential.key_ciphertext);
    const iv = decodeBytea(credential.key_iv);
    const tag = decodeBytea(credential.key_tag);

    if (iv.length !== IV_BYTES) {
      throw new CredentialDecryptError(
        `IV inválido: se esperaban ${IV_BYTES} bytes, hay ${iv.length}`,
      );
    }
    if (tag.length !== TAG_BYTES) {
      throw new CredentialDecryptError(
        `Tag inválido: se esperaban ${TAG_BYTES} bytes, hay ${tag.length}`,
      );
    }

    const aad = credentialAad(userId, provider);
    const keys = this.previousMasterKey
      ? [this.masterKey, this.previousMasterKey]
      : [this.masterKey];

    for (const key of keys) {
      try {
        return decryptWithKey(key, aad, ciphertext, iv, tag);
      } catch {
        // Se prueba la siguiente clave. El error original no se propaga: su
        // mensaje no aporta nada y no queremos arrastrar detalles de cripto.
      }
    }

    throw new CredentialDecryptError(
      `No se pudo descifrar la credencial de ${provider}`,
    );
  }
}
