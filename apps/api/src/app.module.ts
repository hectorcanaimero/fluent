import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { InsforgeModule } from './insforge/insforge.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { CommonModule } from './common/common.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', { infer: true }),
        },
      }),
    }),
    RedisModule,
    InsforgeModule,
    I18nModule,
    // Filtro global de errores (APP_FILTER) y ValidationPipe global
    // (APP_PIPE) de PR-02/T3 (SPEC-02 §6/§8). Sin dependencia de orden con
    // los guards de abajo: los filtros y pipes no se ven afectados por el
    // orden de los `APP_GUARD`.
    CommonModule,
    // AuthModule registra AuthGuard como guard global (APP_GUARD): todas las
    // rutas exigen bearer salvo las marcadas con @Public() (SPEC-02 §4).
    AuthModule,
    // RateLimitModule registra UserThrottlerGuard (APP_GUARD, SPEC-02 §7).
    // Debe ir **después** de AuthModule: con varios APP_GUARD, Nest los
    // ejecuta en el orden de este array de `imports`, y UserThrottlerGuard
    // necesita `request.user` (lo deja AuthGuard) para trackear el límite
    // por usuario en vez de por IP (ver comentario en
    // rate-limit/user-throttler.guard.ts).
    RateLimitModule,
    HealthModule,
    ProfilesModule,
    GroupsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
