import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

/** Cabecera que escribe Cloudflare con la IP real del cliente. */
export const CLIENT_IP_HEADER = 'cf-connecting-ip';

/**
 * IP del cliente para el rate limit (MEJ-30): `CF-Connecting-IP` si
 * Cloudflare la puso, si no la `request.ip` que resuelve Express con
 * `trust proxy`. Exportada para poder probarla sin montar un guard entero.
 */
export function clientIpOf(req: Record<string, unknown>): string | undefined {
  const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
  const forwarded = headers?.[CLIENT_IP_HEADER];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }
  return typeof req.ip === 'string' ? req.ip : undefined;
}

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
 * 2. Cuando no hay usuario, la IP sale de `CF-Connecting-IP` si existe y de
 *    `request.ip` si no (MEJ-30). Detrás de Cloudflare y Traefik, `req.ip`
 *    sin `trust proxy` es la del proxy: **todo** el tráfico anónimo
 *    compartiría un solo cubo de rate limit, así que un cliente cualquiera
 *    podía dejar sin cuota a los demás. `main.ts` activa `trust proxy` para
 *    que Express lea `X-Forwarded-For`; `CF-Connecting-IP` tiene prioridad
 *    porque Cloudflare la reescribe él y no es falsificable desde fuera,
 *    mientras que `X-Forwarded-For` puede traer lo que el cliente quiera
 *    delante de la cadena.
 *
 * 3. `throwThrottlingException`: el `ThrottlerException` por defecto de la
 *    librería produce `{ statusCode: 429, message: 'ThrottlerException: Too
 *    Many Requests' }`, que no es el contrato de SPEC-02 §6. Se sustituye
 *    por `ApiException.of('RATE_LIMITED', …)`, que el filtro global de
 *    PR-02/T3 (`ApiExceptionFilter`) serializa tal cual.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as AuthenticatedRequest;
    return request.user?.id ?? clientIpOf(req) ?? 'unknown';
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
