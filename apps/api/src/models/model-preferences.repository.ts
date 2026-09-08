import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import {
  POSTGRES_UNIQUE_VIOLATION,
  unwrapInsforge,
} from '../insforge/insforge-result.js';
import { TABLES, type ModelPreference, type Provider } from '../db/schema.js';

/** Cuerpo a escribir en `model_preferences` (`PUT /me/models`, SPEC-02 §4.2). */
export interface ModelPreferenceWriteInput {
  readonly chat_provider: Provider;
  readonly chat_model: string;
  readonly brief_provider: Provider;
  readonly brief_model: string;
}

/**
 * Repositorio de `model_preferences` (SPEC-01 §2.5) sobre el cliente admin
 * de InsForge.
 *
 * Vivió temporalmente en `apps/api/src/providers/` desde PR-02/T4 (solo con
 * `find`/`deleteIfUsesProvider`, lo mínimo que necesitaba
 * `DELETE /providers/:provider` para «resetear preferencias que usaban» el
 * proveedor desconectado). PR-02/T5 lo mueve aquí, al módulo de catálogo y
 * preferencias de modelo (`GET /models`, `PUT /me/models`), y le añade
 * `upsert` (docs/specs/pendientes/PR-02.md PEND-26, actualizado). Sigue
 * siendo la **única** clase que escribe esta tabla: `ProvidersModule`
 * importa `ModelsModule` para reutilizarla en vez de duplicarla.
 */
@Injectable()
export class ModelPreferencesRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async find(userId: string): Promise<ModelPreference | null> {
    const result = await this.admin.database
      .from(TABLES.modelPreferences)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<ModelPreference>(result);
  }

  /**
   * Borra la fila de preferencias si alguno de los dos roles (chat o brief)
   * usaba el proveedor que se acaba de desconectar. Devuelve `true` si borró
   * algo.
   *
   * Decisión (docs/specs/pendientes/PR-02.md PEND-26): «resetear» es **borrar
   * la fila entera**, no reasignar el otro proveedor. Es lo más simple y
   * deja al usuario en el mismo estado que antes de elegir modelo: sin
   * preferencia, la cadena de fallback del operador (SPEC-03 §2) sigue
   * funcionando con las credenciales que le queden.
   */
  async deleteIfUsesProvider(userId: string, provider: Provider): Promise<boolean> {
    const preference = await this.find(userId);
    if (
      preference === null ||
      (preference.chat_provider !== provider && preference.brief_provider !== provider)
    ) {
      return false;
    }

    const result = await this.admin.database
      .from(TABLES.modelPreferences)
      .delete()
      .eq('user_id', userId);

    unwrapInsforge(result);
    return true;
  }

  /**
   * Escribe la preferencia del usuario (`PUT /me/models`, SPEC-02 §4.2).
   * `user_id` es la PK de la tabla (SPEC-01 §2.5): UPDATE primero y, si no
   * había fila, INSERT — mismo patrón que
   * `CredentialsRepository.save` (`provider_credentials`, único también por
   * `user_id`+`provider`), con el mismo manejo de la carrera de INSERT
   * concurrente (violación de UNIQUE/PK, código `23505`, reintenta con
   * UPDATE).
   */
  async upsert(userId: string, patch: ModelPreferenceWriteInput): Promise<ModelPreference> {
    const updated = await this.updateRow(userId, patch);
    if (updated) {
      return updated;
    }

    const insertResult = await this.admin.database
      .from(TABLES.modelPreferences)
      .insert({ user_id: userId, ...patch })
      .select('*')
      .maybeSingle();

    if (insertResult.error?.code === POSTGRES_UNIQUE_VIOLATION) {
      const raced = await this.updateRow(userId, patch);
      if (raced) {
        return raced;
      }
    }

    const created = unwrapInsforge<ModelPreference>(insertResult);
    if (created === null) {
      throw new Error('upsert: la escritura de model_preferences no devolvió ninguna fila');
    }
    return created;
  }

  private async updateRow(
    userId: string,
    patch: ModelPreferenceWriteInput,
  ): Promise<ModelPreference | null> {
    const result = await this.admin.database
      .from(TABLES.modelPreferences)
      .update(patch)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    return unwrapInsforge<ModelPreference>(result);
  }
}
