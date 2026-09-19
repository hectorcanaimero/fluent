import { Injectable, Logger } from '@nestjs/common';
import type { Provider, ProviderCredential } from '../db/schema.js';
import type {
  ActiveCredential,
  CredentialsSource,
} from '../llm/model-resolver.js';
import type { CredentialErrorCode } from '../llm/llm.service.js';
import { CredentialsCrypto } from './credentials.crypto.js';
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
/** `last_error` de una credencial cifrada con otra clave maestra. */
export const DECRYPT_FAILED = 'DECRYPT_FAILED';

@Injectable()
export class CredentialsService implements CredentialsSource {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly crypto: CredentialsCrypto,
    private readonly repository: CredentialsRepository,
  ) {}

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
    const encrypted = this.crypto.encrypt(userId, provider, apiKey);

    await this.repository.save({
      userId,
      provider,
      keyCiphertext: encrypted.key_ciphertext,
      keyIv: encrypted.key_iv,
      keyTag: encrypted.key_tag,
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
      return this.crypto.decrypt(row.user_id, row.provider, row);
    } catch {
      this.logger.warn(
        `No se pudo descifrar la credencial de '${row.provider}' del usuario ${row.user_id}; se marca como error.`,
      );
      // Sin esto la fila seguía `active`: la app mostraba "Conectado" pero la
      // API no podía usarla y respondía PROVIDER_NOT_CONNECTED. Marcarla
      // `error` hace que la app pida volver a conectarla.
      void this.repository
        .markError(row.user_id, row.provider, DECRYPT_FAILED)
        .catch(() => undefined);
      return null;
    }
  }
}
