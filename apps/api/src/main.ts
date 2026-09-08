import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  // El filtro global de errores y el ValidationPipe global (PR-02/T3, SPEC-02
  // §6/§8) se registran como providers `APP_FILTER`/`APP_PIPE` en
  // `CommonModule` (importado por `AppModule`), no aquí: así se activan igual
  // en producción (`main.ts`) y en los tests e2e, que arrancan la app con
  // `Test.createTestingModule({ imports: [AppModule] })` sin pasar por esta
  // función. Ver `apps/api/src/common/common.module.ts`.

  app.setGlobalPrefix('v1');

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
