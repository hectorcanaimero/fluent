/**
 * Autorización de owner para las rutas que **no** pasan por el guard global
 * de Nest, montadas como middleware Express crudo:
 *
 * - `/admin/queues` (Bull Board, SPEC-05 §9), fuera del prefijo `v1`.
 * - `/v1/docs` en producción (OpenAPI, SPEC-02 §8).
 *
 * Es la **única** forma de autorizar al owner que queda en el repo tras la
 * integración de PR-05 en PR-02 (docs/specs/pendientes/PR-02.md PEND-73):
 * `OwnerAuthGuard`/`checkOwnerBearer` de `admin/owner-auth.guard.ts` se
 * borraron porque repetían la introspección de token sin caché y con un
 * criterio de owner propio. Aquí se reutilizan las dos piezas que ya existen:
 *
 * - `AuthGuard.resolveUserId` (token → `userId`, con la caché de Redis de
 *   SPEC-02 §2), así que el panel de colas ya no llama a InsForge en cada
 *   petición de cada asset del panel.
 * - `OwnerService.isSystemOwner` (`OWNER_USER_ID`), el mismo criterio que
 *   aplica `AdminService` a `GET /admin/metrics` y `GroupsService` a
 *   `POST /admin/invitations`.
 *
 * El cuerpo de los errores es el de SPEC-02 §6 (`{error, message,
 * statusCode}`), igual que el que produce `ApiExceptionFilter` para las rutas
 * normales: aquí se escribe a mano porque un middleware Express no pasa por
 * los filtros de excepción de Nest.
 */
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { OwnerService } from '../common/owner.service.js';
import { AuthGuard, extractBearerToken } from './auth.guard.js';

/** Resultado de comprobar el bearer de una petición contra el owner. */
export type OwnerBearerCheck =
  | { readonly ok: true; readonly userId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly error: 'UNAUTHENTICATED' | 'FORBIDDEN';
      readonly message: string;
    };

/**
 * Comprueba una cabecera `Authorization` completa. Nunca lanza: devuelve el
 * resultado como dato para que el middleware decida qué responder.
 */
export async function checkOwnerBearer(
  header: string | string[] | undefined,
  authGuard: Pick<AuthGuard, 'resolveUserId'>,
  ownerService: Pick<OwnerService, 'isSystemOwner'>,
): Promise<OwnerBearerCheck> {
  const token = extractBearerToken(header);

  if (token === null) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHENTICATED',
      message: 'Falta la cabecera Authorization con un token Bearer.',
    };
  }

  const userId = await authGuard.resolveUserId(token);

  if (userId === null) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHENTICATED',
      message: 'El token de acceso es inválido o ha expirado.',
    };
  }

  if (!ownerService.isSystemOwner(userId)) {
    return {
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'No tienes permiso para realizar esta acción.',
    };
  }

  return { ok: true, userId };
}

/**
 * Middleware Express listo para `app.use(...)`.
 *
 * `app.get(Token)` (sin `strict`) busca en toda la aplicación, así que
 * encuentra `AuthGuard` (que `AuthModule` expone) y `OwnerService` (declarado
 * como provider en `AdminModule` y en `GroupsModule`; es un envoltorio sin
 * estado sobre `ConfigService`, así que da igual cuál de las dos instancias
 * devuelva).
 */
export function createOwnerBearerMiddleware(app: INestApplication): RequestHandler {
  const authGuard = app.get(AuthGuard);
  const ownerService = app.get(OwnerService);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await checkOwnerBearer(
      req.headers.authorization,
      authGuard,
      ownerService,
    );

    if (!result.ok) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
        statusCode: result.status,
      });
      return;
    }

    next();
  };
}
