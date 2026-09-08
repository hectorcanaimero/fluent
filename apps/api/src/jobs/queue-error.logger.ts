/**
 * Listener de `error` para las cuatro colas.
 *
 * BullMQ, igual que ioredis, reemite en la `Queue` los errores de su conexión.
 * Si nadie escucha ese evento, `EventEmitter` lanza y BullMQ acaba volcando el
 * error crudo por `console.error` — ilegible y fuera del logger de la app. Con
 * un listener quedan como avisos normales (`nestjs-pino`), y el proceso sigue
 * reintentando la conexión según `QUEUE_CLIENT_OPTIONS` (ver
 * `redis/redis.module.ts` y PEND-01 de docs/specs/pendientes/PR-05.md).
 */
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from './jobs.constants.js';

@Injectable()
export class QueueErrorLogger implements OnModuleInit {
  private readonly logger = new Logger('BullQueue');

  constructor(
    @InjectQueue(QUEUE_BRIEF) private readonly brief: Queue,
    @InjectQueue(QUEUE_CONTENT) private readonly content: Queue,
    @InjectQueue(QUEUE_SOCIAL) private readonly social: Queue,
    @InjectQueue(QUEUE_MAINTENANCE) private readonly maintenance: Queue,
  ) {}

  onModuleInit(): void {
    for (const queue of [
      this.brief,
      this.content,
      this.social,
      this.maintenance,
    ]) {
      queue.on('error', (error: Error) => {
        this.logger.warn(`[${queue.name}] ${error.message}`);
      });
    }
  }
}
