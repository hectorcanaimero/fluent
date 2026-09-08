/**
 * Registro de los 4 crons de la cola `maintenance` (SPEC-05 §1).
 *
 * Mismo mecanismo que `rss-ingest.cron.ts` y
 * `weekly-summary-dispatch.registrar.ts`: `Queue.upsertJobScheduler`, no
 * `queue.add(name, data, { repeat })` (PEND-15/16 de
 * docs/specs/pendientes/PR-05.md — `bullmq@6.3.4` quitó `repeat` de
 * `JobsOptions`). Cada uno con su propio `schedulerId` estable, así que
 * reiniciar el worker no crea entradas duplicadas.
 *
 * La cola `maintenance` tiene `attempts: 1` por defecto
 * (`QUEUE_DEFAULT_JOB_OPTIONS[QUEUE_MAINTENANCE]`, ver jobs.constants.ts y
 * PEND-05 de docs/specs/pendientes/PR-05.md), pero SPEC-05 §1 da un número de
 * reintentos distinto a cada uno de los 4 jobs de esta cola. `attempts` se
 * sobreescribe aquí en `jobTemplate.opts`, tercer argumento de
 * `upsertJobScheduler`, que gana sobre el default de la cola.
 */
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  JOB_DAILY_STREAKS,
  JOB_MODEL_CATALOG,
  JOB_RETENTION,
  JOB_SESSION_SWEEPER,
  QUEUE_MAINTENANCE,
} from '../jobs.constants.js';

/** SPEC-05 §1: «cron cada minuto», 0 reintentos. */
export const SESSION_SWEEPER_CRON_PATTERN = '* * * * *';
export const SESSION_SWEEPER_SCHEDULER_ID = 'cron-session-sweeper';
export const SESSION_SWEEPER_ATTEMPTS = 1;

/** SPEC-05 §1: «cron diario 03:30 UTC», 1 reintento. */
export const DAILY_STREAKS_CRON_PATTERN = '30 3 * * *';
export const DAILY_STREAKS_SCHEDULER_ID = 'cron-daily-streaks';
export const DAILY_STREAKS_ATTEMPTS = 2;

/** SPEC-05 §1: «cron diario 04:00 UTC», 1 reintento. */
export const RETENTION_CRON_PATTERN = '0 4 * * *';
export const RETENTION_SCHEDULER_ID = 'cron-retention';
export const RETENTION_ATTEMPTS = 2;

/** SPEC-05 §1: «cron cada 6 h», 2 reintentos. */
export const MODEL_CATALOG_CRON_PATTERN = '0 */6 * * *';
export const MODEL_CATALOG_SCHEDULER_ID = 'cron-model-catalog';
export const MODEL_CATALOG_ATTEMPTS = 3;

@Injectable()
export class MaintenanceCronRegistrar implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceCronRegistrar.name);

  constructor(
    @InjectQueue(QUEUE_MAINTENANCE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SESSION_SWEEPER_SCHEDULER_ID,
      { pattern: SESSION_SWEEPER_CRON_PATTERN, tz: 'UTC' },
      {
        name: JOB_SESSION_SWEEPER,
        data: {},
        opts: { attempts: SESSION_SWEEPER_ATTEMPTS },
      },
    );
    await this.queue.upsertJobScheduler(
      DAILY_STREAKS_SCHEDULER_ID,
      { pattern: DAILY_STREAKS_CRON_PATTERN, tz: 'UTC' },
      {
        name: JOB_DAILY_STREAKS,
        data: {},
        opts: { attempts: DAILY_STREAKS_ATTEMPTS },
      },
    );
    await this.queue.upsertJobScheduler(
      RETENTION_SCHEDULER_ID,
      { pattern: RETENTION_CRON_PATTERN, tz: 'UTC' },
      {
        name: JOB_RETENTION,
        data: {},
        opts: { attempts: RETENTION_ATTEMPTS },
      },
    );
    await this.queue.upsertJobScheduler(
      MODEL_CATALOG_SCHEDULER_ID,
      { pattern: MODEL_CATALOG_CRON_PATTERN, tz: 'UTC' },
      {
        name: JOB_MODEL_CATALOG,
        data: {},
        opts: { attempts: MODEL_CATALOG_ATTEMPTS },
      },
    );

    this.logger.log(
      `crons de maintenance registrados: session-sweeper (${SESSION_SWEEPER_CRON_PATTERN}), ` +
        `daily-streaks (${DAILY_STREAKS_CRON_PATTERN}), retention (${RETENTION_CRON_PATTERN}), ` +
        `model-catalog (${MODEL_CATALOG_CRON_PATTERN}) — UTC`,
    );
  }
}
