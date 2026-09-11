import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CACHE_CLIENT } from './redis.constants.js';

/**
 * Envoltorio fino sobre la conexión de caché de Redis, para que otros
 * módulos (por ejemplo `HealthService` o `AuthGuard`) no se acoplen
 * directamente a `ioredis`.
 *
 * Política común a todos los métodos: **nunca lanzan**. Un Redis caído
 * degrada el servicio (más llamadas a InsForge, catálogos recalculados)
 * pero no debe tumbar peticiones, así que los errores se loguean como
 * `warn` y se devuelve el valor neutro (`null` / `false` / nada).
 *
 * La firma de `get`/`set` es intencionadamente compatible con la interfaz
 * `CacheStore` de `apps/api/src/llm/catalog.service.ts`
 * (`get(key): Promise<string | null>`, `set(key, value, ttlSeconds):
 * Promise<void>`), para que ese servicio pueda usar `RedisService`
 * directamente como almacén.
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

  /**
   * Lee una clave de la caché. Devuelve `null` si no existe **o** si Redis
   * falla: para quien llama, un fallo de caché es indistinguible de un
   * *miss*, que es exactamente el comportamiento deseado.
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.cacheClient.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis GET '${key}' falló: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Escribe una clave con expiración (`SET key value EX ttlSeconds`).
   *
   * Devuelve `Promise<void>` (y no un booleano de éxito) a propósito, para
   * ser compatible con la interfaz `CacheStore` del catálogo de modelos: un
   * fallo de escritura solo significa «no se cacheó», nunca un error que
   * quien llama deba manejar, así que se traga aquí dentro.
   */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cacheClient.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis SET '${key}' falló: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Escritura condicional con expiración (`SET key value EX ttlSeconds NX`),
   * el primitivo de los locks y de las ventanas de ritmo: devuelve `true`
   * solo si la clave **no existía** y por tanto la escribió esta llamada.
   *
   * **Redis caído ⇒ `true` (fail-open).** Rompe la simetría con el resto de
   * métodos (que devuelven el valor neutro) a propósito, y por el mismo
   * criterio que ellos: un fallo de caché degrada, no tumba. Los dos usos
   * previstos son optimizaciones —el lock de turno de SPEC-04 §4 y el ritmo
   * de 2 s de SPEC-02 §7—, así que devolver `false` con Redis caído
   * bloquearía **todos** los turnos de **todos** los usuarios mientras dure
   * la caída, que es mucho peor que perder temporalmente la protección
   * contra dos turnos simultáneos de la misma sesión. Ver
   * docs/specs/pendientes/PR-04.md.
   */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      const reply = await this.cacheClient.set(key, value, 'EX', ttlSeconds, 'NX');
      return reply === 'OK';
    } catch (error) {
      this.logger.warn(
        `Redis SET NX '${key}' falló: ${(error as Error).message}. Se continúa sin lock (fail-open).`,
      );
      return true;
    }
  }

  /**
   * Incrementa un contador y, si es el primero, le pone TTL. Devuelve el
   * valor tras incrementar, o `null` si Redis falló.
   *
   * `null` es «no lo sé», no «cero»: quien llama decide. El tope diario de
   * turnos (MAL-23) lo trata como fail-open, igual que el lock de turno: con
   * Redis caído es peor bloquear a todo el mundo que perder temporalmente el
   * tope.
   *
   * El `EXPIRE` solo se aplica cuando el contador vale 1 —es decir, cuando
   * esta llamada lo creó—, para no ir alargando la ventana con cada turno.
   */
  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      const value = await this.cacheClient.incr(key);
      if (value === 1) {
        await this.cacheClient.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      this.logger.warn(
        `Redis INCR '${key}' falló: ${(error as Error).message}. Se continúa sin contador (fail-open).`,
      );
      return null;
    }
  }

  /**
   * Borra una clave. Devuelve `true` si se borró algo, `false` si la clave
   * no existía o si Redis falló.
   */
  async del(key: string): Promise<boolean> {
    try {
      const removed = await this.cacheClient.del(key);
      return removed > 0;
    } catch (error) {
      this.logger.warn(
        `Redis DEL '${key}' falló: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
