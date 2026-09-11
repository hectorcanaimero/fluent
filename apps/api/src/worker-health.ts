/**
 * HEALTHCHECK del contenedor del worker (MEJ-27): lee el latido de Redis y
 * sale con 0 si está fresco, 1 si no.
 *
 * Script suelto en vez de un endpoint HTTP porque el worker no levanta
 * servidor, y en vez de `redis-cli` porque la imagen no lo trae. Usa `ioredis`
 * directamente y no el `RedisService` de Nest: arrancar el árbol de módulos
 * entero cada 30 segundos para leer una clave sería absurdo.
 */
import { Redis } from 'ioredis';
import { WORKER_HEARTBEAT_KEY } from './health/worker-heartbeat.js';

async function main(): Promise<number> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error('worker-health: falta REDIS_URL');
    return 1;
  }

  const redis = new Redis(url, {
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const beat = await redis.get(WORKER_HEARTBEAT_KEY);
    if (beat === null) {
      console.error('worker-health: sin latido reciente del worker');
      return 1;
    }
    return 0;
  } catch (error) {
    console.error('worker-health: no se pudo leer el latido', error);
    return 1;
  } finally {
    redis.disconnect();
  }
}

main().then(
  (code) => {
    process.exit(code);
  },
  () => {
    process.exit(1);
  },
);
