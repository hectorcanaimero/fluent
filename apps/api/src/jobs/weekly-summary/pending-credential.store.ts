/**
 * `pendingActions` para el owner sin credencial activa (SPEC-05 §4 paso 3).
 *
 * PR-02 implementa `GET /me` y su campo `pendingActions`; la instrucción de
 * la sesión líder para PR-05/T3 es dejar el dato en Redis para que PR-02 lo
 * lea, documentado con detalle en `docs/specs/pendientes/PR-05.md`.
 *
 * Formato exacto (ver también las pendientes):
 * - Clave: `fluent:pending:weekly-summary-credential:<ownerId>`.
 *   El resto de claves de BullMQ usan el prefijo `fluent:` a través de la
 *   opción `prefix` de la librería (que añade los dos puntos ella sola); esta
 *   clave no es de BullMQ, así que aquí el prefijo `fluent:` se escribe a
 *   mano para mantener la misma convención del proyecto (SPEC-05 §1).
 * - Valor: JSON `{ groupId: string, weekStart: string, code: 'NO_CREDENTIAL' }`.
 * - TTL: 30 días (2 592 000 s) — hasta el próximo ciclo semanal con margen.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CACHE_CLIENT } from '../../redis/redis.constants.js';

const KEY_PREFIX = 'fluent:pending:weekly-summary-credential:';
/** 30 días, en segundos. */
export const PENDING_CREDENTIAL_TTL_SECONDS = 30 * 24 * 3600;

export type PendingWeeklySummaryCredentialCode = 'NO_CREDENTIAL';

export interface PendingWeeklySummaryCredential {
  readonly groupId: string;
  readonly weekStart: string;
  readonly code: PendingWeeklySummaryCredentialCode;
}

export function pendingCredentialKey(ownerId: string): string {
  return `${KEY_PREFIX}${ownerId}`;
}

@Injectable()
export class WeeklySummaryPendingCredentialStore {
  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
  ) {}

  /** Marca que el owner no tiene credencial activa para el rol `brief`. */
  async markMissing(
    ownerId: string,
    payload: Omit<PendingWeeklySummaryCredential, 'code'>,
  ): Promise<void> {
    const value: PendingWeeklySummaryCredential = {
      groupId: payload.groupId,
      weekStart: payload.weekStart,
      code: 'NO_CREDENTIAL',
    };
    await this.redis.set(
      pendingCredentialKey(ownerId),
      JSON.stringify(value),
      'EX',
      PENDING_CREDENTIAL_TTL_SECONDS,
    );
  }

  /**
   * Borra la clave pendiente de un owner. Se llama tras un `weekly-summary`
   * con éxito (ver PEND correspondiente en pendientes/PR-05.md: se limpia
   * solo tras éxito, no antes de reintentar el LLM, por simplicidad).
   */
  async clear(ownerId: string): Promise<void> {
    await this.redis.del(pendingCredentialKey(ownerId));
  }
}
