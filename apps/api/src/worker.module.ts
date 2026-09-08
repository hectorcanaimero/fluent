import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.js';
import { RedisModule } from './redis/redis.module.js';
import { InsforgeModule } from './insforge/insforge.module.js';

/**
 * Módulo raíz del worker (proceso separado de la API, mismo código fuente
 * y misma imagen Docker — ver `apps/api/Dockerfile` y SPEC-08 §1/§4).
 *
 * Vacío por ahora: sin controllers ni providers propios. PR-05 lo llenará
 * con los procesadores de BullMQ (colas de generación/publicación) que
 * necesitarán `REDIS_QUEUE_CLIENT` (de `RedisModule`) e InsForge (de
 * `InsforgeModule`).
 *
 * `ConfigModule` y `LoggerModule` se importan aquí igual que en
 * `AppModule` porque el worker arranca como proceso Nest independiente
 * (`node dist/worker.js`, ver `apps/api/src/worker.ts`), no comparte
 * contexto de inyección con la API. `RedisModule` e `InsforgeModule` son
 * `@Global()`, así que basta con importarlos una vez aquí para que
 * cualquier processor futuro los inyecte sin volver a importarlos.
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
        pinoHttp: {
          level: configService.get('LOG_LEVEL', { infer: true }),
        },
      }),
    }),
    RedisModule,
    InsforgeModule,
  ],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
