import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import {
  POSTGRES_UNIQUE_VIOLATION,
  unwrapInsforge,
} from '../insforge/insforge-result.js';
import {
  TABLES,
  type CredentialStatus,
  type Provider,
  type ProviderCredential,
} from '../db/schema.js';

/**
 * Estado de conexión de un proveedor tal y como lo necesitan `GET /me`
 * (SPEC-02 §4.1) y `GET /providers/:provider/status` (§4.2).
 *
 * `not_connected` no es uno de los tres estados de SPEC-01 §2.4
 * (`active`/`revoked`/`error`): es el que se usa cuando **no hay fila** en
 * `provider_credentials`, el único que le sirve a la app para «nunca se
 * conectó» (`apps/mobile/lib/core/api/models.dart::ProviderInfo.status` es un
 * `String` sin enum). Ver docs/specs/pendientes/PR-02.md PEND-15.
 */
export type ProviderConnectionStatus = CredentialStatus | 'not_connected';

export interface ProviderStatusRow {
  provider: Provider;
  status: ProviderConnectionStatus;
  connectedAt: string | null;
}

/** Fila a guardar en `provider_credentials` (columnas `bytea` ya en `\x<hex>`). */
export interface CredentialRowInput {
  readonly userId: string;
  readonly provider: Provider;
  readonly keyCiphertext: string;
  readonly keyIv: string;
  readonly keyTag: string;
}

const PROVIDER_IDS: readonly Provider[] = ['openrouter', 'gemini'];

/**
 * Repositorio de `provider_credentials` (SPEC-01 §2.4) sobre el cliente admin
 * de InsForge. Esta tabla no tiene ninguna política RLS para `authenticated`:
 * solo la API la lee y la escribe.
 *
 * Ninguna función de aquí descifra nada ni ve una key en claro: solo mueve
 * las tres columnas `bytea` (serializadas como el string `\x<hex>` que
 * PostgREST acepta y devuelve). El cifrado vive en `CredentialsService`.
 */
@Injectable()
export class CredentialsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async find(userId: string, provider: Provider): Promise<ProviderCredential | null> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    return unwrapInsforge<ProviderCredential>(result);
  }

  /** Todas las credenciales del usuario, con el estado que tengan. */
  async listByUser(userId: string): Promise<ProviderCredential[]> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .select('*')
      .eq('user_id', userId);

    return unwrapInsforge<ProviderCredential[]>(result) ?? [];
  }

  /** Solo las credenciales `status = 'active'` (lo que consume `CredentialsSource`). */
  async listActiveByUser(userId: string): Promise<ProviderCredential[]> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    return unwrapInsforge<ProviderCredential[]>(result) ?? [];
  }

  /**
   * Guarda la credencial del par `(user_id, provider)`, que es UNIQUE
   * (SPEC-01 §2.4): reconecta el proveedor dejándola `active`, sin
   * `last_error` y con `connected_at = now()`.
   *
   * Se hace UPDATE y, si no había fila, INSERT (en vez de un `upsert` de
   * PostgREST) porque así funciona igual sea cual sea la versión de
   * PostgREST detrás de InsForge. Si dos peticiones concurrentes intentan
   * insertar a la vez, la que pierde recibe una violación de UNIQUE y
   * reintenta el UPDATE.
   */
  async save(input: CredentialRowInput): Promise<ProviderCredential> {
    const patch = {
      key_ciphertext: input.keyCiphertext,
      key_iv: input.keyIv,
      key_tag: input.keyTag,
      status: 'active' satisfies CredentialStatus,
      last_error: null,
      connected_at: new Date().toISOString(),
    };

    const updated = await this.updateRow(input.userId, input.provider, patch);
    if (updated) {
      return updated;
    }

    const insertResult = await this.admin.database
      .from(TABLES.providerCredentials)
      .insert({ user_id: input.userId, provider: input.provider, ...patch })
      .select('*')
      .maybeSingle();

    if (insertResult.error?.code === POSTGRES_UNIQUE_VIOLATION) {
      const raced = await this.updateRow(input.userId, input.provider, patch);
      if (raced) {
        return raced;
      }
    }

    const created = unwrapInsforge<ProviderCredential>(insertResult);
    if (created === null) {
      throw new Error('save: la inserción de provider_credentials no devolvió ninguna fila');
    }
    return created;
  }

  /**
   * Marca la credencial como `error` con `last_error` (evento
   * `credential.error` de SPEC-03 §2, códigos `AUTH_ERROR` / `NO_CREDITS`
   * según docs/specs/pendientes/PR-03.md PEND-07).
   *
   * Devuelve `false` si el usuario ya no tiene fila de ese proveedor (por
   * ejemplo, la desconectó mientras había una llamada en vuelo): no es un
   * error, simplemente no hay nada que marcar.
   */
  async markError(
    userId: string,
    provider: Provider,
    lastError: string,
  ): Promise<boolean> {
    const updated = await this.updateRow(userId, provider, {
      status: 'error' satisfies CredentialStatus,
      last_error: lastError,
    });
    return updated !== null;
  }

  /** Borra la credencial. Devuelve `true` si había algo que borrar. */
  async remove(userId: string, provider: Provider): Promise<boolean> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider)
      .select('id');

    const rows = unwrapInsforge<{ id: string }[]>(result) ?? [];
    return rows.length > 0;
  }

  /**
   * Estado de conexión de **los dos** proveedores (`GET /me`, SPEC-02 §4.1).
   * Proyección mínima: nunca lee las columnas `bytea` con la key cifrada.
   */
  async listStatuses(userId: string): Promise<ProviderStatusRow[]> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .select('provider, status, connected_at')
      .eq('user_id', userId);

    const rows =
      unwrapInsforge<
        { provider: Provider; status: CredentialStatus; connected_at: string }[]
      >(result) ?? [];

    const byProvider = new Map(rows.map((row) => [row.provider, row]));

    return PROVIDER_IDS.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        status: row ? row.status : ('not_connected' as const),
        connectedAt: row?.connected_at ?? null,
      };
    });
  }

  private async updateRow(
    userId: string,
    provider: Provider,
    patch: Record<string, unknown>,
  ): Promise<ProviderCredential | null> {
    const result = await this.admin.database
      .from(TABLES.providerCredentials)
      .update(patch)
      .eq('user_id', userId)
      .eq('provider', provider)
      .select('*')
      .maybeSingle();

    return unwrapInsforge<ProviderCredential>(result);
  }
}
