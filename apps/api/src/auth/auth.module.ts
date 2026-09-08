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
 * No declara `providers` extra: `AuthGuard` inyecta `Reflector` (lo
 * proporciona `@nestjs/core`), `RedisService` e `InsforgeHttp`, y estos dos
 * últimos vienen de módulos `@Global()` (`RedisModule`, `InsforgeModule`).
 */
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
