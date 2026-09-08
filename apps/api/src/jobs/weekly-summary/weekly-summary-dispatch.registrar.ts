/**
 * Registro del job repetible `weekly-summary-dispatch` (SPEC-05 §4).
 *
 * Se registra en `OnModuleInit`, mismo mecanismo que usará el cron de PR-05/T2
 * (BullMQ repeatable jobs, no `@nestjs/schedule`).
 *
 * `bullmq@6` (ver `pnpm-lock.yaml`) quitó la opción `repeat` de `Queue.add`:
 * ahora los jobs repetibles se registran con `Queue.upsertJobScheduler`, que
 * además ya es idempotente por diseño (upsert por `jobSchedulerId`), así que
 * no hace falta un `jobId` propio como con la API vieja. Ver pendientes de
 * docs/specs/pendientes/PR-05.md.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { JOB_WEEKLY_SUMMARY_DISPATCH, QUEUE_SOCIAL } from '../jobs.constants.js';

/** SPEC-05 §1: «cron lunes 07:00 UTC». */
export const WEEKLY_SUMMARY_DISPATCH_CRON = '0 7 * * 1';
export const WEEKLY_SUMMARY_DISPATCH_SCHEDULER_ID = 'cron-weekly-summary-dispatch';

@Injectable()
export class WeeklySummaryDispatchRegistrar implements OnModuleInit {
  private readonly logger = new Logger(WeeklySummaryDispatchRegistrar.name);

  constructor(@InjectQueue(QUEUE_SOCIAL) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      WEEKLY_SUMMARY_DISPATCH_SCHEDULER_ID,
      { pattern: WEEKLY_SUMMARY_DISPATCH_CRON, tz: 'UTC' },
      { name: JOB_WEEKLY_SUMMARY_DISPATCH, data: {} },
    );
    this.logger.log(
      `weekly-summary-dispatch registrado (${WEEKLY_SUMMARY_DISPATCH_CRON} UTC)`,
    );
  }
}
