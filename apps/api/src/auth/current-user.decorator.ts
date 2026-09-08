import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types.js';

/**
 * Inyecta el usuario autenticado que `AuthGuard` dejó en la petición.
 *
 * ```ts
 * @Get('/me')
 * me(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * @Get('/me')
 * me(@CurrentUser('id') userId: string) { ... }
 * ```
 *
 * Si no hay usuario en la petición lanza `401 UNAUTHENTICATED`. En la
 * práctica no debería ocurrir (el guard global corre antes y ya rechaza la
 * petición), pero sí ocurriría si alguien usa `@CurrentUser()` en una ruta
 * marcada con `@Public()`; fallar de forma explícita es preferible a
 * devolver `undefined` y arrastrar el fallo hasta la capa de datos.
 */
export const CurrentUser = createParamDecorator(
  (
    field: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw ApiException.unauthenticated(
        'No hay usuario autenticado en la petición.',
      );
    }

    return field ? user[field] : user;
  },
);
