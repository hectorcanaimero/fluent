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
 * haya listeners/handles activos (p. ej. las conexiones de `RedisModule`),
 * sin necesidad de un `setInterval` ni similar para evitar que el event
 * loop termine.
 *
 * Sin `ValidationPipe` ni `setGlobalPrefix`: son específicos de HTTP
 * (`@nestjs/platform-express`) y el worker no expone ningún endpoint.
 */
async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  await app.init();
}

// Sin `await` a nivel de módulo, mismo motivo que en `main.ts`: evita
// `ERR_REQUIRE_ASYNC_MODULE` si algo carga `dist/worker.js` con `require()`.
bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- el logger de Nest aún no existe si bootstrap() falla antes de crearlo
  console.error('Error fatal al arrancar el worker', error);
  process.exitCode = 1;
});
