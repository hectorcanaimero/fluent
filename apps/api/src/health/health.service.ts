import { Injectable } from '@nestjs/common';
import { APP_VERSION } from '../config/version.js';
import { RedisService } from '../redis/redis.service.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';

/**
 * Resultado de `GET /v1/health`.
 *
 * `redis.ok` viene de `RedisService.pingCache()` (PING sobre la conexión de
 * caché) e `insforge.ok` de `InsforgeHttp.checkHealth()`. `ok` de nivel
 * superior es `redis.ok && insforge.ok`.
 */
export interface HealthStatus {
  ok: boolean;
  version: string;
  redis: { ok: boolean };
  insforge: { ok: boolean };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly redisService: RedisService,
    private readonly insforgeHttp: InsforgeHttp,
  ) {}

  async check(): Promise<HealthStatus> {
    const [redisOk, insforgeOk] = await Promise.all([
      this.redisService.pingCache(),
      this.insforgeHttp.checkHealth(),
    ]);

    return {
      ok: redisOk && insforgeOk,
      version: APP_VERSION,
      redis: { ok: redisOk },
      insforge: { ok: insforgeOk },
    };
  }
}
