/**
 * Infraestructura de colas (SPEC-05 §1).
 *
 * Módulo `@Global()` que registra la conexión de BullMQ y las cuatro colas.
 * Lo importan tanto `AppModule` (la API, que solo **encola** a través de
 * `JOB_DISPATCHER`) como `WorkerModule` (que además importa `JobsModule` con
 * los procesadores).
 */
import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { QUEUE_CLIENT_OPTIONS } from '../redis/redis.module.js';
import { BullJobDispatcher, JOB_DISPATCHER } from './job-dispatcher.js';
import {
  BULL_PREFIX,
  QUEUE_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
} from './jobs.constants.js';
import { QueueErrorLogger } from './queue-error.logger.js';

/**
 * Una cola por entrada de la tabla de SPEC-05 §1, con sus `defaultJobOptions`
 * (reintentos y backoff). La concurrencia no va aquí: es una opción del
 * `Worker`, y se declara en cada `@Processor` (ver `JOB_QUEUE_CONCURRENCY`).
 */
const queueModules: DynamicModule[] = QUEUE_NAMES.map((name) =>
  BullModule.registerQueue({
    name,
    prefix: BULL_PREFIX,
    defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS[name],
  }),
);

@Global()
@Module({
  imports: [
    /**
     * Conexión de BullMQ.
     *
     * Se le pasan **opciones**, no la instancia `REDIS_QUEUE_CLIENT` de
     * `RedisModule`, a propósito (PEND-01 de docs/specs/pendientes/PR-05.md):
     * BullMQ necesita varias conexiones por cola (una normal y otra
     * bloqueante por `Worker`) y, si recibe una instancia ya creada, la marca
     * como compartida y no puede duplicarla ni cerrarla en el apagado. Las
     * opciones son las mismas (`QUEUE_CLIENT_OPTIONS`: `maxRetriesPerRequest:
     * null` y reintento indefinido con backoff acotado), así que ambas rutas
     * hablan con el mismo Redis con la misma política de reconexión.
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        connection: {
          url: configService.get('REDIS_URL', { infer: true }),
          ...QUEUE_CLIENT_OPTIONS,
        },
        prefix: BULL_PREFIX,
      }),
    }),
    ...queueModules,
  ],
  providers: [
    { provide: JOB_DISPATCHER, useClass: BullJobDispatcher },
    QueueErrorLogger,
  ],
  exports: [...queueModules, JOB_DISPATCHER],
})
export class QueuesModule {}
