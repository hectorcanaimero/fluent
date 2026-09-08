import { Injectable, Logger } from '@nestjs/common';
import {
  pendingCredentialKey,
  type PendingWeeklySummaryCredential,
} from '../jobs/weekly-summary/pending-credential.store.js';
import { RedisService } from '../redis/redis.service.js';

/**
 * Acciones pendientes de `GET /me` (`MeDto.pendingActions`, SPEC-02 §4.1).
 *
 * Hoy solo hay una, la de SPEC-05 §4 paso 3: el job `weekly-summary` no pudo
 * generar el resumen del grupo porque **el owner** no tiene ninguna credencial
 * de proveedor activa. PR-05 deja ese aviso en Redis
 * (`fluent:pending:weekly-summary-credential:<ownerId>`, TTL 30 días, valor
 * JSON `{groupId, weekStart, code}`) y lo borra tras el primer resumen con
 * éxito; PR-02 solo lo lee. Ver PEND-17 de `docs/specs/pendientes/PR-05.md` y
 * PEND-76 de `docs/specs/pendientes/PR-02.md`.
 *
 * La clave se construye con `pendingCredentialKey`, importada del propio
 * módulo que la escribe, para que las dos mitades no puedan desincronizarse.
 */

/**
 * Identificador de acción pendiente: string en MAYÚSCULAS y estable, con el
 * mismo estilo que los códigos de error de SPEC-02 §6. `pendingActions` es un
 * `string[]` y `apps/mobile/lib/core/api/models.dart` no lo interpreta, así
 * que la app ignora sin romperse cualquier valor que no conozca; por eso este
 * identificador puede crecer a una lista sin cambiar el contrato.
 */
export const WEEKLY_SUMMARY_NEEDS_CREDENTIAL = 'WEEKLY_SUMMARY_NEEDS_CREDENTIAL';

@Injectable()
export class PendingActionsService {
  private readonly logger = new Logger(PendingActionsService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Acciones pendientes del usuario. **Nunca lanza**: `RedisService.get` ya
   * devuelve `null` si Redis está caído (misma política que PEND-01: la caché
   * es una optimización, no una dependencia dura), y un valor con un JSON
   * ilegible se ignora con un `warn`. En ambos casos `GET /me` responde con la
   * lista vacía en vez de fallar.
   */
  async listFor(userId: string): Promise<string[]> {
    const raw = await this.redisService.get(pendingCredentialKey(userId));
    if (raw === null) {
      return [];
    }

    // El valor solo se usa para confirmar que la clave es la que espera esta
    // versión; el detalle (`groupId`, `weekStart`) no viaja en `pendingActions`,
    // que es un `string[]`.
    try {
      const value = JSON.parse(raw) as Partial<PendingWeeklySummaryCredential>;
      if (value.code !== 'NO_CREDENTIAL') {
        return [];
      }
    } catch {
      this.logger.warn(
        'La clave de acción pendiente del resumen semanal no contiene un JSON válido; se ignora.',
      );
      return [];
    }

    return [WEEKLY_SUMMARY_NEEDS_CREDENTIAL];
  }
}
