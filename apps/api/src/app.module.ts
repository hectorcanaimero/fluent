import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { InsforgeModule } from './insforge/insforge.module.js';
import { QueuesModule } from './jobs/queues.module.js';
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
    RedisModule,
    InsforgeModule,
    // Solo la infraestructura de colas: la API encola (`JOB_DISPATCHER`) pero
    // no consume. Los procesadores viven en `JobsModule`, que importa el
    // worker (`worker.module.ts`).
    QueuesModule,
    HealthModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
