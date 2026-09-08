import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { Provider, ProviderCredential } from '../db/schema.js';
import type {
  ActiveCredential,
  CredentialsSource,
} from '../llm/model-resolver.js';
import type { CredentialErrorCode } from '../llm/llm.service.js';
import {
  credentialAad,
  decodeMasterKey,
  decryptSecret,
  encryptSecret,
  fromByteaHex,
  toByteaHex,
} from './credentials.crypto.js';
import {
  CredentialsRepository,
  type ProviderStatusRow,
} from './credentials.repository.js';

/**
 * Credenciales de proveedor cifradas (SPEC-02 §5, RF-2.2).
 *
 * Implementa `CredentialsSource` de `apps/api/src/llm/model-resolver.ts`, así
 * que PR-04 y PR-05 pueden inyectar este servicio tal cual para conseguir las
 * keys activas de un usuario ya descifradas.
 *
 * Invariante de seguridad (SPEC-02 §5): la key en claro solo vive en memoria.
 * Este servicio nunca la registra en el log, nunca la devuelve en un DTO de
 * un endpoint y nunca la mete en el mensaje de una excepción; solo la entrega
 * a quien va a llamar al proveedor (`LlmClient`).
 */
@Injectable()
export class CredentialsService implements CredentialsSource {
  private readonly logger = new Logger(CredentialsService.name);

  /** Clave con la que se **cifra** siempre (la actual). */
  private readonly currentKey: Buffer;
  /**
   * Claves con las que se intenta **descifrar**, en orden: la actual y, si
   * está configurada, la anterior (`CREDENTIALS_MASTER_KEY_PREVIOUS`), que es
   * lo que permite rotar sin recifrar todas las filas de golpe.
   */
  private readonly decryptionKeys: readonly Buffer[];

  constructor(
    configService: ConfigService<Env, true>,
    private readonly repository: CredentialsRepository,
  ) {
    // Falla el arranque si la clave maestra no es base64 de 32 bytes.
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

  /**
   * `CredentialsSource.listActive`: credenciales `active` del usuario con la
   * key ya descifrada.
   *
   * Una fila que no se pueda descifrar (clave rotada sin dejar la anterior en
   * `CREDENTIALS_MASTER_KEY_PREVIOUS`, fila alterada) se **omite** con un
   * `warn`, en vez de tumbar la llamada: el resto de proveedores del usuario
   * siguen sirviendo para la cadena de fallback de SPEC-03 §2.
   */
  async listActive(userId: string): Promise<readonly ActiveCredential[]> {
    const rows = await this.repository.listActiveByUser(userId);
    const credentials: ActiveCredential[] = [];

    for (const row of rows) {
      const apiKey = this.tryDecrypt(row);
      if (apiKey !== null) {
        credentials.push({ provider: row.provider, apiKey });
      }
    }

    return credentials;
  }

  /**
   * Key en claro de un proveedor concreto, o `null` si el usuario no tiene
   * credencial activa de ese proveedor. Solo para uso interno de la API
   * (consulta de créditos de OpenRouter, llamadas al LLM): **nunca** debe
   * acabar en una respuesta HTTP.
   */
  async getActiveApiKey(userId: string, provider: Provider): Promise<string | null> {
    const row = await this.repository.find(userId, provider);
    if (row === null || row.status !== 'active') {
      return null;
    }
    return this.tryDecrypt(row);
  }

  /**
   * Cifra y guarda la key de un proveedor (siempre con la clave maestra
   * actual) dejando la credencial `active`, sin `last_error` y con
   * `connected_at = now()`.
   */
  async saveApiKey(userId: string, provider: Provider, apiKey: string): Promise<void> {
    const secret = encryptSecret(
      this.currentKey,
      apiKey,
      credentialAad(userId, provider),
    );

    await this.repository.save({
      userId,
      provider,
      keyCiphertext: toByteaHex(secret.ciphertext),
      keyIv: toByteaHex(secret.iv),
      keyTag: toByteaHex(secret.tag),
    });
  }

  /**
   * Marca la credencial como `error` con el código del evento
   * `credential.error` (`AUTH_ERROR` o `NO_CREDITS`, tal cual, según
   * docs/specs/pendientes/PR-03.md PEND-07).
   */
  async markCredentialError(
    userId: string,
    provider: Provider,
    code: CredentialErrorCode,
  ): Promise<void> {
    await this.repository.markError(userId, provider, code);
  }

  /** Borra la credencial (`DELETE /providers/:provider`, SPEC-02 §4.2). */
  async remove(userId: string, provider: Provider): Promise<boolean> {
    return this.repository.remove(userId, provider);
  }

  /** Fila de `provider_credentials` sin descifrar nada (estado y `last_error`). */
  async find(userId: string, provider: Provider): Promise<ProviderCredential | null> {
    return this.repository.find(userId, provider);
  }

  /** Estado de conexión de los dos proveedores (`GET /me`, SPEC-02 §4.1). */
  async listStatuses(userId: string): Promise<ProviderStatusRow[]> {
    return this.repository.listStatuses(userId);
  }

  /**
   * Descifra una fila. Devuelve `null` (y loguea `warn`) en vez de lanzar: el
   * log solo dice qué usuario y qué proveedor, nunca el contenido cifrado ni
   * la key.
   */
  private tryDecrypt(row: ProviderCredential): string | null {
    try {
      return decryptSecret(
        this.decryptionKeys,
        {
          ciphertext: fromByteaHex(row.key_ciphertext),
          iv: fromByteaHex(row.key_iv),
          tag: fromByteaHex(row.key_tag),
        },
        credentialAad(row.user_id, row.provider),
      );
    } catch {
      this.logger.warn(
        `No se pudo descifrar la credencial de '${row.provider}' del usuario ${row.user_id}; se ignora.`,
      );
      return null;
    }
  }
}
