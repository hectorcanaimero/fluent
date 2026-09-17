import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { Env } from './config/env.js';
import { setupOpenApi } from './openapi.js';
import { mountBullBoard } from './admin/bull-board.js';
import { createOwnerBearerMiddleware } from './auth/owner-bearer.middleware.js';
import { configureHttpServer } from './config/http-server.js';

async function bootstrap() {
  // Tipado como app de Express para poder tocar `set('trust proxy')` (MEJ-30).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  // Coolify manda SIGTERM en cada deploy. Sin los shutdown hooks, Nest no
  // ejecuta los `onModuleDestroy`/`onApplicationShutdown` (conexiones de
  // Redis, colas de BullMQ) y el contenedor muere a los 10 s por SIGKILL,
  // cortando los turnos en vuelo. Ver MAL-21.
  app.enableShutdownHooks();

  // El filtro global de errores y el ValidationPipe global (PR-02/T3, SPEC-02
  // §6/§8) se registran como providers `APP_FILTER`/`APP_PIPE` en
  // `CommonModule` (importado por `AppModule`), no aquí: así se activan igual
  // en producción (`main.ts`) y en los tests e2e, que arrancan la app con
  // `Test.createTestingModule({ imports: [AppModule] })` sin pasar por esta
  // función. Ver `apps/api/src/common/common.module.ts`.

  // Express detrás de Traefik y Cloudflare (SPEC-08 §1). Sin esto `req.ip` es
  // la del proxy y todo el tráfico anónimo comparte un único cubo de rate
  // limit. `1` = un salto de confianza: se cree la última entrada de
  // `X-Forwarded-For`, la que añade nuestro propio proxy, no la cadena entera
  // que el cliente puede inventarse. Ver MEJ-30.
  app.set('trust proxy', 1);

  // CORS para la build web de Flutter, servida desde otro origen. `*` sin
  // credenciales es seguro aquí: la API no usa cookies, todo va por Bearer, y
  // el navegador no adjunta ese token a peticiones de terceros.
  app.enableCors();

  app.setGlobalPrefix('v1');

  // Bull Board (SPEC-05 §9): panel de las 4 colas de BullMQ en
  // `/admin/queues`, protegido por bearer de owner. Ver `admin/bull-board.ts`
  // — extraído a una función propia para que los tests e2e puedan montarlo
  // también sobre una app de test que no pasa por este `bootstrap()`.
  mountBullBoard(app);

  const configService = app.get(ConfigService<Env, true>);
  const nodeEnv = configService.get('NODE_ENV', { infer: true });

  // OpenAPI en `/v1/docs` (SPEC-02 §8). En producción, antes de
  // `setupOpenApi`, se instala el middleware de owner: la documentación no es
  // pública en el despliegue real. Es el mismo middleware que protege
  // `/admin/queues` (`auth/owner-bearer.middleware.ts`), así que hay una sola
  // implementación de "bearer válido y además owner" en todo el repo.
  if (nodeEnv === 'production') {
    app.use(/^\/v1\/docs/, createOwnerBearerMiddleware(app));
  }

  setupOpenApi(app, configService);

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);

  // Después de `listen`: antes de esa llamada `getHttpServer()` devuelve un
  // servidor todavía sin arrancar y Nest lo sustituye al escuchar.
  configureHttpServer(app.getHttpServer());
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
