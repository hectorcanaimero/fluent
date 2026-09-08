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
 * - `maxRetriesPerRequest` + `retryStrategy` acotados: si Redis no está
 *   disponible, un comando (p. ej. el `PING` de `RedisService.pingCache`)
 *   falla en un par de cientos de ms en vez de reintentar indefinidamente
 *   (por defecto ioredis reintenta sin límite con backoff creciente).
 *   En producción, con Redis real, esto solo acota cuánto se tarda en
 *   detectar una caída antes de reportarla en `/v1/health`; no afecta al
 *   funcionamiento normal.
 * - Un listener de `error` es obligatorio en ioredis: sin él, un error de
 *   socket no manejado tira el proceso entero (comportamiento por defecto
 *   de `EventEmitter`).
 */
const REDIS_CLIENT_OPTIONS: RedisOptions = {
  lazyConnect: true,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  retryStrategy: (times: number) => (times > 2 ? null : 100),
};

function createRedisClient(redisUrl: string, label: string): Redis {
  const client = new Redis(redisUrl, REDIS_CLIENT_OPTIONS);
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
    ),
};

const cacheClientProvider: Provider = {
  provide: REDIS_CACHE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    createRedisClient(
      configService.get('REDIS_URL', { infer: true }),
      'cache',
    ),
};

/**
 * Módulo global de Redis: expone dos conexiones ioredis independientes
 * (misma URL/Redis físico, dos clientes lógicos) para que módulos futuros
 * de otros PRs las inyecten sin volver a importar este módulo:
 *
 * - `REDIS_QUEUE_CLIENT`: reservada para BullMQ (colas), que necesita su
 *   propia conexión dedicada.
 * - `REDIS_CACHE_CLIENT`: caché de prompts/noticias/tokens. `RedisService`
 *   la envuelve para exponer `pingCache()` sin acoplar a otros módulos a
 *   `ioredis` directamente.
 */
@Global()
@Module({
  providers: [queueClientProvider, cacheClientProvider, RedisService],
  exports: [REDIS_QUEUE_CLIENT, REDIS_CACHE_CLIENT, RedisService],
})
export class RedisModule {}
