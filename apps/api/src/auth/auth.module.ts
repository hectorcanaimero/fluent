import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';

/**
 * Módulo de autenticación (SPEC-02 §2).
 *
 * Registra `AuthGuard` como guard **global** vía `APP_GUARD`: toda ruta
 * exige `Authorization: Bearer <accessToken>` salvo las marcadas con
 * `@Public()` (SPEC-02 §4: «Todos requieren bearer salvo `/health`»).
 *
 * `AuthGuard` se declara además como provider normal y el `APP_GUARD` lo
 * referencia con `useExisting`, no con `useClass`: así hay **una sola**
 * instancia y se puede recuperar con `app.get(AuthGuard)` desde `main.ts` y
 * desde `admin/bull-board.ts`, que necesitan resolver el bearer del owner en
 * middleware Express crudo (`auth/owner-bearer.middleware.ts`). Con
 * `useClass` el token registrado sería `APP_GUARD` y `app.get(AuthGuard)`
 * fallaría.
 *
 * No declara más providers: `AuthGuard` inyecta `Reflector` (lo proporciona
 * `@nestjs/core`), `RedisService` e `InsforgeHttp`, y estos dos últimos
 * vienen de módulos `@Global()` (`RedisModule`, `InsforgeModule`).
 */
@Module({
  providers: [
    AuthGuard,
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
