import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module.js';
import { RedisService } from './redis/redis.service.js';
import {
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from './health/worker-heartbeat.js';

/**
 * Punto de entrada del worker (`node dist/worker.js`, ver
 * `apps/api/Dockerfile` y SPEC-08 §1/§4: misma imagen que la API, comando
 * de arranque sobrescrito en Coolify).
 *
 * Sin servidor HTTP: no llama a `app.listen()`. `app.init()` inicializa el
 * árbol de módulos de Nest (y con él los processors de BullMQ de
 * `JobsModule`, que empiezan a consumir jobs) y mantiene el proceso vivo
 * mientras haya listeners/handles activos (las conexiones de `RedisModule` y
 * las de los `Worker` de BullMQ ya bastan por sí solas). Se conserva de
 * todos modos el `setInterval` de mantenimiento y el manejo de SIGTERM/SIGINT
 * para un cierre limpio (Coolify manda SIGTERM en cada deploy): es un
 * cinturón de seguridad barato y un apagado ordenado (`app.close()` antes de
 * salir) es mejor que depender solo de que el proceso muera cuando BullMQ
 * cierre sus conexiones.
 *
 * Sin `ValidationPipe` ni `setGlobalPrefix`: son específicos de HTTP
 * (`@nestjs/platform-express`) y el worker no expone ningún endpoint.
 */
async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  await app.init();

  const logger = app.get(Logger);
  logger.log('Worker iniciado; procesadores de colas activos (PR-05)', 'Worker');

  // Latido en Redis (MEJ-27). El HEALTHCHECK del contenedor comprobaba solo
  // que el proceso existiera (`pgrep`), que es casi no comprobar nada: un
  // worker con las colas caídas o el bucle bloqueado seguía "sano". Ahora
  // escribe una marca con TTL, así que dejar de latir lo marca como enfermo.
  //
  // De paso hace de cinturón de seguridad que mantiene el proceso vivo,
  // como el `setInterval` vacío que había antes.
  const redis = app.get(RedisService);
  const beat = async (): Promise<void> => {
    await redis.set(
      WORKER_HEARTBEAT_KEY,
      new Date().toISOString(),
      WORKER_HEARTBEAT_TTL_SECONDS,
    );
  };
  await beat();
  const keepAlive = setInterval(() => void beat(), WORKER_HEARTBEAT_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    logger.log(`Señal ${signal} recibida, cerrando el worker`, 'Worker');
    clearInterval(keepAlive);
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

// Sin `await` a nivel de módulo, mismo motivo que en `main.ts`: evita
// `ERR_REQUIRE_ASYNC_MODULE` si algo carga `dist/worker.js` con `require()`.
bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- el logger de Nest aún no existe si bootstrap() falla antes de crearlo
  console.error('Error fatal al arrancar el worker', error);
  process.exitCode = 1;
});
