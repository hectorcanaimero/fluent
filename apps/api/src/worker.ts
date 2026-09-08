import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module.js';

/**
 * Punto de entrada del worker (`node dist/worker.js`, ver
 * `apps/api/Dockerfile` y SPEC-08 §1/§4: misma imagen que la API, comando
 * de arranque sobrescrito en Coolify).
 *
 * Sin servidor HTTP: no llama a `app.listen()`. `app.init()` inicializa el
 * árbol de módulos de Nest (y con él, cuando PR-05 añada los processors de
 * BullMQ, empieza a consumir jobs) y mantiene el proceso vivo mientras
 * haya handles activos. Como `RedisModule` conecta de forma perezosa y aún
 * no hay procesadores, se añade un `setInterval` de mantenimiento y manejo
 * de SIGTERM para un cierre limpio.
 *
 * Sin `ValidationPipe` ni `setGlobalPrefix`: son específicos de HTTP
 * (`@nestjs/platform-express`) y el worker no expone ningún endpoint.
 */
async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  await app.init();

  const logger = app.get(Logger);
  logger.log('Worker iniciado; a la espera de procesadores de colas (PR-05)', 'Worker');

  // Mantener el proceso vivo aunque ningún módulo tenga handles abiertos
  // todavía (RedisModule conecta de forma perezosa). Cuando PR-05 registre
  // los workers de BullMQ, esto deja de ser necesario pero no molesta.
  const keepAlive = setInterval(() => undefined, 60_000);

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
