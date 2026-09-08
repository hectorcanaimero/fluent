import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { Env } from './config/env.js';
import { mountBullBoard } from './admin/bull-board.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('v1');

  // Bull Board (SPEC-05 §9): panel de las 4 colas de BullMQ en
  // `/admin/queues`, protegido por bearer de owner. Ver `admin/bull-board.ts`
  // — extraído a una función propia para que los tests e2e puedan montarlo
  // también sobre una app de test que no pasa por este `bootstrap()`.
  mountBullBoard(app);

  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

// Sin `await` a nivel de módulo a propósito: con `"type": "module"` un
// top-level await impide que `require()` (usado por ejemplo por
// herramientas o scripts CJS que cargan `dist/main.js`) resuelva el grafo
// ESM de forma síncrona (Node lanza `ERR_REQUIRE_ASYNC_MODULE`). Se deja
// como promesa "flotante" con manejo explícito de error, el patrón
// histórico de arranque de NestJS antes de que existiera top-level await.
bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- el logger de Nest aún no existe si bootstrap() falla antes de crearlo
  console.error('Error fatal al arrancar la API', error);
  process.exitCode = 1;
});
