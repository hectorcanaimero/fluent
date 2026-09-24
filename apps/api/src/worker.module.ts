import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.js';
import { buildPinoHttpOptions } from './config/logger.js';
import { RedisModule } from './redis/redis.module.js';
import { InsforgeModule } from './insforge/insforge.module.js';
import { QueuesModule } from './jobs/queues.module.js';
import { JobsModule } from './jobs/jobs.module.js';

/**
 * Módulo raíz del worker (proceso separado de la API, mismo código fuente
 * y misma imagen Docker — ver `apps/api/Dockerfile` y SPEC-08 §1/§4).
 *
 * `QueuesModule` (PR-05/T1) registra la conexión de BullMQ y las cuatro colas
 * de SPEC-05 §1; `JobsModule` registra los procesadores que las consumen (hoy
 * solo `coaching-brief`; T2 a T4 añaden los suyos dentro de `JobsModule`, sin
 * volver a tocar este archivo).
 *
 * `ConfigModule` y `LoggerModule` se importan aquí igual que en
 * `AppModule` porque el worker arranca como proceso Nest independiente
 * (`node dist/worker.js`, ver `apps/api/src/worker.ts`), no comparte
 * contexto de inyección con la API. `RedisModule`, `InsforgeModule` y
 * `QueuesModule` son `@Global()`, así que basta con importarlos una vez aquí
 * para que cualquier processor los inyecte sin volver a importarlos.
 */
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
        pinoHttp: buildPinoHttpOptions({
          LOG_LEVEL: configService.get('LOG_LEVEL', { infer: true }),
        }),
      }),
    }),
    RedisModule,
    InsforgeModule,
    QueuesModule,
    JobsModule,
  ],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
