import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES, type ModelPreference, type Provider } from '../db/schema.js';

/**
 * Lecturas y borrados mínimos de `model_preferences` (SPEC-01 §2.5) que
 * necesita `DELETE /providers/:provider` («borra la credencial y resetea
 * preferencias que la usaban», SPEC-02 §4.2).
 *
 * El módulo completo de preferencias de modelo (`PUT /me/models`,
 * `GET /models`) es PR-02/T5; cuando exista, esta clase debería moverse allí
 * y este módulo inyectarla. Ver docs/specs/pendientes/PR-02.md.
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
   * Decisión (docs/specs/pendientes/PR-02.md): «resetear» es **borrar la fila
   * entera**, no reasignar el otro proveedor. Es lo más simple y deja al
   * usuario en el mismo estado que antes de elegir modelo: sin preferencia,
   * la cadena de fallback del operador (SPEC-03 §2) sigue funcionando con las
   * credenciales que le queden.
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
}
