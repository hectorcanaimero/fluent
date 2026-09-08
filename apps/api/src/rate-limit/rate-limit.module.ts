import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard.js';
import {
  DEFAULT_THROTTLER_NAME,
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
  TURNS_THROTTLER_NAME,
  TURNS_THROTTLE_DEFAULT_LIMIT,
  TURNS_THROTTLE_TTL_MS,
} from './rate-limit.constants.js';

/**
 * Rate limiting global (SPEC-02 §7): 60 peticiones por minuto por usuario en
 * general, más el throttler nombrado `'turns'` que PR-04 estrechará a 20/min
 * en `POST /sessions/:id/turns` (ver `rate-limit.constants.ts`).
 *
 * Almacenamiento: el de memoria por defecto de `@nestjs/throttler`
 * (`ThrottlerStorageService`), sin configurar `storage`. Es lo más simple y
 * basta para v1 (SPEC-08: una sola instancia de la API). **Pendiente
 * documentado** (docs/specs/pendientes/PR-02.md): con varias réplicas de la
 * API cada una tendría su propio contador en memoria, así que el límite
 * efectivo se multiplicaría por el número de réplicas — haría falta el
 * storage de Redis (`@nest-lab/throttler-storage-redis` o equivalente) sobre
 * `REDIS_CACHE_CLIENT` (`apps/api/src/redis/redis.constants.ts`), que ya
 * existe para esto.
 *
 * Debe importarse **después** de `AuthModule` en `AppModule` (ver el
 * comentario de orden de guards en `UserThrottlerGuard`).
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: DEFAULT_THROTTLER_NAME,
        ttl: DEFAULT_THROTTLE_TTL_MS,
        limit: DEFAULT_THROTTLE_LIMIT,
      },
      {
        name: TURNS_THROTTLER_NAME,
        ttl: TURNS_THROTTLE_TTL_MS,
        limit: TURNS_THROTTLE_DEFAULT_LIMIT,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class RateLimitModule {}
