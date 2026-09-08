import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

/**
 * `ThrottlerGuard` con clave por usuario (SPEC-02 §7).
 *
 * Dos cambios sobre el guard base de `@nestjs/throttler`:
 *
 * 1. `getTracker`: usa `request.user.id` (lo deja `AuthGuard`,
 *    `apps/api/src/auth/auth.types.ts`) en vez de la IP. Cae a la IP cuando
 *    no hay usuario — el único caso hoy es una ruta `@Public()` como
 *    `/health` (aunque `/health` además está marcada `@SkipThrottle()`, ver
 *    `HealthController`, así que en la práctica esto solo importaría si
 *    apareciera una ruta pública sin `@SkipThrottle()` en el futuro).
 *
 *    **Orden de guards:** esto exige que `request.user` ya exista cuando
 *    corre este guard, es decir, que `AuthGuard` (global, `AuthModule`) se
 *    ejecute **antes**. Con varios `APP_GUARD`, Nest los ejecuta en el orden
 *    en que sus módulos aparecen en `imports` de `AppModule`
 *    (`apps/api/src/app.module.ts`): `AuthModule` está antes que
 *    `RateLimitModule`, así que `AuthGuard` corre primero. Si algún día se
 *    reordenan esos imports, este guard empezaría a trackear por IP para
 *    todo el mundo sin avisar — no hay forma de detectarlo en tiempo de
 *    compilación, por eso este comentario y el test de integración de
 *    `user-throttler.guard.spec.ts` que comprueba que dos usuarios
 *    distintos tienen presupuestos de rate limit independientes.
 *
 * 2. `throwThrottlingException`: el `ThrottlerException` por defecto de la
 *    librería produce `{ statusCode: 429, message: 'ThrottlerException: Too
 *    Many Requests' }`, que no es el contrato de SPEC-02 §6. Se sustituye
 *    por `ApiException.of('RATE_LIMITED', …)`, que el filtro global de
 *    PR-02/T3 (`ApiExceptionFilter`) serializa tal cual.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as AuthenticatedRequest;
    return request.user?.id ?? request.ip ?? 'unknown';
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw ApiException.of(
      'RATE_LIMITED',
      'Hiciste demasiadas peticiones. Esperá un momento y volvé a intentarlo.',
    );
  }
}
