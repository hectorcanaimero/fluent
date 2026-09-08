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
    // AuthModule registra AuthGuard como guard global (APP_GUARD): todas las
    // rutas exigen bearer salvo las marcadas con @Public() (SPEC-02 §4).
    AuthModule,
    HealthModule,
    ProfilesModule,
    GroupsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
