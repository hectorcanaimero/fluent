/**
 * `CacheStore` (interfaz de `apps/api/src/llm/catalog.service.ts`, PR-03)
 * implementado contra `REDIS_CACHE_CLIENT` (SPEC-05 §8).
 *
 * PR-03 dejó dicho «PR-08/T3 implementará CacheStore con Redis», pero ese PR
 * nunca llegó a esta rama. `MaintenanceModule` es el primer módulo que
 * necesita de verdad un `CacheStore` contra Redis (para que `model-catalog`
 * pueda llamar a `ModelCatalogService.refresh()`), así que la implementación
 * vive aquí. Es infraestructura genérica, no específica de mantenimiento: si
 * en el futuro otro módulo necesita un `CacheStore` de propósito general
 * contra Redis, este es el candidato natural a moverse a un sitio más
 * compartido (p. ej. `apps/api/src/redis/`). No se mueve en esta tarea
 * porque no hay todavía un segundo consumidor que lo justifique. Ver
 * PEND-24 de docs/specs/pendientes/PR-05.md.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import type { CacheStore } from '../../llm/catalog.service.js';
import { REDIS_CACHE_CLIENT } from '../../redis/redis.constants.js';

@Injectable()
export class RedisCacheStore implements CacheStore {
  constructor(@Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
}
