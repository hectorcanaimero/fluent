import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import type { Env } from '../config/env.js';
import { REDIS_CACHE_CLIENT, REDIS_QUEUE_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

const logger = new Logger('RedisModule');

/**
 * Opciones comunes a ambas conexiones.
 *
 * - `lazyConnect: true`: no conecta al instanciar el cliente, solo al
 *   primer comando. Evita que `AppModule` intente conectarse de verdad a
 *   Redis en el arranque (importante en tests e2e, donde `REDIS_URL` de
 *   `.env.test` no apunta a un Redis real).
 * - Un listener de `error` es obligatorio en ioredis: sin él, un error de
 *   socket no manejado tira el proceso entero (comportamiento por defecto
 *   de `EventEmitter`).
 */
const COMMON_CLIENT_OPTIONS: RedisOptions = {
  lazyConnect: true,
};

/**
 * Conexión de caché (`REDIS_CACHE_CLIENT`): pensada para el healthcheck y
 * para lecturas/escrituras de caché donde es preferible fallar rápido.
 *
 * `maxRetriesPerRequest` + `retryStrategy` acotados: si Redis no está
 * disponible, un comando (p. ej. el `PING` de `RedisService.pingCache`)
 * falla en un par de cientos de ms en vez de reintentar indefinidamente
 * (por defecto ioredis reintenta sin límite con backoff creciente).
 * En producción, con Redis real, esto solo acota cuánto se tarda en
 * detectar una caída antes de reportarla en `/v1/health`; no afecta al
 * funcionamiento normal.
 */
const CACHE_CLIENT_OPTIONS: RedisOptions = {
  ...COMMON_CLIENT_OPTIONS,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  retryStrategy: (times: number) => (times > 2 ? null : 100),
};

/**
 * Conexión de colas (`REDIS_QUEUE_CLIENT`) y opciones que usa BullMQ para
 * crear las suyas (ver `jobs/queues.module.ts` y PEND-01 de
 * `docs/specs/pendientes/PR-05.md`).
 *
 * Aquí NO vale el fast-fail de la caché:
 *
 * - BullMQ **exige** `maxRetriesPerRequest: null` en las conexiones de sus
 *   `Worker` (los comandos bloqueantes tipo `BZPOPMIN` viven más que
 *   cualquier límite de reintentos) y lo recomienda para las `Queue`. Con
 *   cualquier otro valor lanza un error explícito al construir la conexión.
 * - Un `retryStrategy` que devuelve `null` hace que ioredis se rinda y cierre
 *   la conexión para siempre. En una cola real eso significa dejar de
 *   consumir jobs si Redis se reinicia un segundo. Por eso se reintenta
 *   indefinidamente con backoff acotado (200 ms, 400 ms… hasta 5 s).
 *
 * `lazyConnect` se mantiene: BullMQ conecta explícitamente cuando crea sus
 * `Queue`/`Worker`, y para `REDIS_QUEUE_CLIENT` evita abrir un socket en el
 * arranque de procesos que no usan colas.
 *
 * El tipo se deja inferir (con `satisfies` para no perder la comprobación
 * contra `RedisOptions` de ioredis) porque BullMQ declara su propia interfaz
 * `RedisOptions`, más estrecha, y el tipo ancho de ioredis no es asignable a
 * ella.
 */
export const QUEUE_CLIENT_OPTIONS = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: (times: number): number => Math.min(times * 200, 5000),
} satisfies RedisOptions;

function createRedisClient(
  redisUrl: string,
  label: string,
  options: RedisOptions,
): Redis {
  const client = new Redis(redisUrl, options);
  client.on('error', (error: Error) => {
    logger.warn(`[${label}] error de conexión: ${error.message}`);
  });
  return client;
}

const queueClientProvider: Provider = {
  provide: REDIS_QUEUE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    createRedisClient(
      configService.get('REDIS_URL', { infer: true }),
      'queue',
      QUEUE_CLIENT_OPTIONS,
    ),
};

const cacheClientProvider: Provider = {
  provide: REDIS_CACHE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    createRedisClient(
      configService.get('REDIS_URL', { infer: true }),
      'cache',
      CACHE_CLIENT_OPTIONS,
    ),
};

/**
 * Módulo global de Redis: expone dos conexiones ioredis independientes
 * (misma URL/Redis físico, dos clientes lógicos) para que módulos futuros
 * de otros PRs las inyecten sin volver a importar este módulo:
 *
 * - `REDIS_QUEUE_CLIENT`: conexión con opciones compatibles con BullMQ,
 *   para comandos sueltos sobre el keyspace de colas (`fluent:*`).
 *   BullMQ **no** reutiliza esta instancia: crea las suyas a partir de
 *   `QUEUE_CLIENT_OPTIONS` (ver `jobs/queues.module.ts`).
 * - `REDIS_CACHE_CLIENT`: caché de prompts/noticias/tokens, con fast-fail.
 *   `RedisService` la envuelve para exponer `pingCache()` sin acoplar a
 *   otros módulos a `ioredis` directamente.
 */
@Global()
@Module({
  providers: [queueClientProvider, cacheClientProvider, RedisService],
  exports: [REDIS_QUEUE_CLIENT, REDIS_CACHE_CLIENT, RedisService],
})
export class RedisModule {}
