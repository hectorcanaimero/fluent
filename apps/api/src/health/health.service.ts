import { Inject, Injectable, Optional } from '@nestjs/common';
import { APP_VERSION } from '../config/version.js';
import { RedisService } from '../redis/redis.service.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';

/**
 * Resultado de `GET /v1/health` y `GET /v1/health/ready`.
 *
 * `redis.ok` viene de `RedisService.pingCache()` (PING sobre la conexión de
 * caché) e `insforge.ok` de `InsforgeHttp.checkHealth()`.
 *
 * `ok` es lo que distingue los dos endpoints (MEJ-27):
 * - **liveness** (`/health`): `ok: true` mientras el proceso responda, aunque
 *   Redis o InsForge estén caídos. Es el que mira el HEALTHCHECK del
 *   contenedor, y reiniciar la API porque Redis no contesta no arregla nada:
 *   solo añade un corte de servicio a un fallo que es de otro.
 * - **readiness** (`/health/ready`): `ok` solo si ambas dependencias están.
 *   Sirve para decidir si mandarle tráfico, y responde `503` si no.
 */
export interface HealthStatus {
  ok: boolean;
  version: string;
  redis: { ok: boolean };
  insforge: { ok: boolean };
}

/**
 * Cuánto se reutiliza el resultado de las comprobaciones (MEJ-27). Coolify
 * pregunta cada pocos segundos y cada respuesta cuesta un PING a Redis y un
 * `GET /api/health` a InsForge; sin caché, el propio healthcheck es una
 * fuente de carga constante.
 */
export const HEALTH_CACHE_MS = 5_000;

/**
 * Token del reloj, solo para poder probar la caché sin esperar de verdad.
 * Es `@Optional()`: en producción nadie lo provee y se usa `Date.now`.
 */
export const HEALTH_CLOCK = Symbol('HEALTH_CLOCK');

@Injectable()
export class HealthService {
  private cached: { at: number; redis: boolean; insforge: boolean } | null = null;
  private inFlight: Promise<{ redis: boolean; insforge: boolean }> | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly insforgeHttp: InsforgeHttp,
    @Optional() @Inject(HEALTH_CLOCK) private readonly now: () => number = Date.now,
  ) {}

  /** Liveness: `ok` mientras el proceso conteste. */
  async check(): Promise<HealthStatus> {
    const { redis, insforge } = await this.probe();
    return {
      ok: true,
      version: APP_VERSION,
      redis: { ok: redis },
      insforge: { ok: insforge },
    };
  }

  /** Readiness: `ok` solo con las dos dependencias arriba. */
  async ready(): Promise<HealthStatus> {
    const { redis, insforge } = await this.probe();
    return {
      ok: redis && insforge,
      version: APP_VERSION,
      redis: { ok: redis },
      insforge: { ok: insforge },
    };
  }

  /**
   * Comprueba las dependencias, reutilizando el resultado durante
   * [HEALTH_CACHE_MS]. Las llamadas concurrentes comparten la misma promesa,
   * así que una ráfaga de healthchecks no multiplica las comprobaciones.
   */
  private async probe(): Promise<{ redis: boolean; insforge: boolean }> {
    const cached = this.cached;
    if (cached !== null && this.now() - cached.at < HEALTH_CACHE_MS) {
      return { redis: cached.redis, insforge: cached.insforge };
    }

    this.inFlight ??= this.runProbe().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async runProbe(): Promise<{ redis: boolean; insforge: boolean }> {
    const [redis, insforge] = await Promise.all([
      this.redisService.pingCache(),
      this.insforgeHttp.checkHealth(),
    ]);

    this.cached = { at: this.now(), redis, insforge };
    return { redis, insforge };
  }
}
