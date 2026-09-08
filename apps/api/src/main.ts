import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { Env } from './config/env.js';
import { setupOpenApi } from './openapi.js';
import { InsforgeHttp } from './insforge/insforge.http.js';

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
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const ownerUserId = configService.get('OWNER_USER_ID', { infer: true });

  // OpenAPI en `/v1/docs` (SPEC-02 §8).
  // En producción, antes de `setupOpenApi`, instala un middleware que exige
  // bearer válido del owner para acceder a `/v1/docs*` (documentación).
  if (nodeEnv === 'production') {
    const insforgeHttp = app.get(InsforgeHttp);

    app.use(
      /^\/v1\/docs/,
      async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Extrae el bearer de `Authorization: Bearer <token>`.
        const authHeader = req.headers.authorization as string | undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: 'UNAUTHENTICATED',
            message: 'Falta un token de acceso válido.',
            statusCode: 401,
          });
          return;
        }

        const token = authHeader.slice('Bearer '.length);

        try {
          // Verifica el token contra InsForge (mismo patrón que AuthGuard).
          const session = await insforgeHttp.getCurrentSession(token);
          if (!session.ok || session.userId !== ownerUserId) {
            res.status(403).json({
              error: 'FORBIDDEN',
              message: 'No tienes permiso para realizar esta acción.',
              statusCode: 403,
            });
            return;
          }
          next();
        } catch {
          res.status(401).json({
            error: 'UNAUTHENTICATED',
            message: 'Token inválido o expirado.',
            statusCode: 401,
          });
        }
      },
    );
  }

  setupOpenApi(app, configService);

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
