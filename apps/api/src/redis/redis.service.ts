import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CACHE_CLIENT } from './redis.constants.js';

/**
 * Envoltorio fino sobre la conexión de caché de Redis, para que otros
 * módulos (por ejemplo `HealthService`) no se acoplen directamente a
 * `ioredis`.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly cacheClient: Redis,
  ) {}

  /**
   * Hace `PING` sobre la conexión de caché. Nunca lanza: si algo falla
   * (Redis caído, timeout, etc.) se atrapa el error y se devuelve `false`.
   */
  async pingCache(): Promise<boolean> {
    try {
      const reply = await this.cacheClient.ping();
      return reply === 'PONG';
    } catch (error) {
      this.logger.warn(`Redis PING falló: ${(error as Error).message}`);
      return false;
    }
  }
}
