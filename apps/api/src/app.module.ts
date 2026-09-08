import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { InsforgeModule } from './insforge/insforge.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { CredentialsModule } from './credentials/credentials.module.js';
import { ModelsModule } from './models/models.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { LlmInfraModule } from './llm/llm-infra.module.js';
import { CommonModule } from './common/common.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { SocialModule } from './social/social.module.js';
import { AdminModule } from './admin/admin.module.js';

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
    // Bus de eventos en proceso (`@nestjs/event-emitter`): lo usa el evento
    // `credential.error` de SPEC-03 §2 (`NestLlmEventBus` lo emite,
    // `CredentialErrorListener` lo consume). Es global, así que basta con
    // registrarlo una vez aquí.
    EventEmitterModule.forRoot(),
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
    CredentialsModule,
    // `ModelsModule` (catálogo y preferencias, SPEC-02 §4.2, PR-02/T5) va
    // antes de `ProvidersModule`: éste la importa para reutilizar
    // `ModelPreferencesRepository` en `DELETE /providers/:provider`
    // (docs/specs/pendientes/PR-02.md PEND-26). El orden de este array no
    // afecta a la resolución de dependencias entre módulos (solo importa
    // para el orden de los `APP_GUARD`, ver PEND-23); se declara así para
    // que se lea en el mismo orden en que se resuelven.
    ModelsModule,
    ProvidersModule,
    // Implementaciones de `LlmCallSink` y `LlmEventBus` (PR-03) sobre
    // InsForge y `EventEmitter2`; PR-04 y PR-05 importan este módulo.
    LlmInfraModule,
    // Hechos y coaching brief del usuario (PR-02/T6, SPEC-02 §4.4).
    MemoryModule,
    // Progreso y gamificación (PR-02/T7, SPEC-02 §4.5, SPEC-07): `GET
    // /progress`, `GET /leaderboard`, `GET /challenges`,
    // `GET /weekly-summary`. Ver el aviso de coordinación con PR-07 en
    // docs/specs/pendientes/PR-02.md.
    ProgressModule,
    SocialModule,
    // Endpoints administrativos (PR-02/T8, SPEC-02 §4.6, RF-8.2): `GET /admin/metrics`.
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
