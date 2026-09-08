import type { Queue } from 'bullmq';

import {
  JOB_DAILY_STREAKS,
  JOB_MODEL_CATALOG,
  JOB_RETENTION,
  JOB_SESSION_SWEEPER,
} from '../jobs.constants.js';
import {
  DAILY_STREAKS_ATTEMPTS,
  DAILY_STREAKS_CRON_PATTERN,
  DAILY_STREAKS_SCHEDULER_ID,
  MODEL_CATALOG_ATTEMPTS,
  MODEL_CATALOG_CRON_PATTERN,
  MODEL_CATALOG_SCHEDULER_ID,
  MaintenanceCronRegistrar,
  RETENTION_ATTEMPTS,
  RETENTION_CRON_PATTERN,
  RETENTION_SCHEDULER_ID,
  SESSION_SWEEPER_ATTEMPTS,
  SESSION_SWEEPER_CRON_PATTERN,
  SESSION_SWEEPER_SCHEDULER_ID,
} from './maintenance.cron.js';

describe('MaintenanceCronRegistrar', () => {
  it('SPEC-05 §1: los 4 patrones de cron son los de la tabla', () => {
    expect(SESSION_SWEEPER_CRON_PATTERN).toBe('* * * * *');
    expect(DAILY_STREAKS_CRON_PATTERN).toBe('30 3 * * *');
    expect(RETENTION_CRON_PATTERN).toBe('0 4 * * *');
    expect(MODEL_CATALOG_CRON_PATTERN).toBe('0 */6 * * *');
  });

  it('registra los 4 job schedulers con patrón, tz UTC y attempts correctos', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;
    const registrar = new MaintenanceCronRegistrar(queue);

    await registrar.onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(4);
    expect(upsertJobScheduler).toHaveBeenNthCalledWith(
      1,
      SESSION_SWEEPER_SCHEDULER_ID,
      { pattern: '* * * * *', tz: 'UTC' },
      { name: JOB_SESSION_SWEEPER, data: {}, opts: { attempts: SESSION_SWEEPER_ATTEMPTS } },
    );
    expect(upsertJobScheduler).toHaveBeenNthCalledWith(
      2,
      DAILY_STREAKS_SCHEDULER_ID,
      { pattern: '30 3 * * *', tz: 'UTC' },
      { name: JOB_DAILY_STREAKS, data: {}, opts: { attempts: DAILY_STREAKS_ATTEMPTS } },
    );
    expect(upsertJobScheduler).toHaveBeenNthCalledWith(
      3,
      RETENTION_SCHEDULER_ID,
      { pattern: '0 4 * * *', tz: 'UTC' },
      { name: JOB_RETENTION, data: {}, opts: { attempts: RETENTION_ATTEMPTS } },
    );
    expect(upsertJobScheduler).toHaveBeenNthCalledWith(
      4,
      MODEL_CATALOG_SCHEDULER_ID,
      { pattern: '0 */6 * * *', tz: 'UTC' },
      { name: JOB_MODEL_CATALOG, data: {}, opts: { attempts: MODEL_CATALOG_ATTEMPTS } },
    );

    expect(SESSION_SWEEPER_ATTEMPTS).toBe(1);
    expect(DAILY_STREAKS_ATTEMPTS).toBe(2);
    expect(RETENTION_ATTEMPTS).toBe(2);
    expect(MODEL_CATALOG_ATTEMPTS).toBe(3);
  });

  it('reiniciar el registrador vuelve a llamar con los mismos argumentos (BullMQ deduplica por schedulerId)', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;

    await new MaintenanceCronRegistrar(queue).onModuleInit();
    await new MaintenanceCronRegistrar(queue).onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(8);
    const firstRun = upsertJobScheduler.mock.calls.slice(0, 4);
    const secondRun = upsertJobScheduler.mock.calls.slice(4, 8);
    expect(firstRun).toEqual(secondRun);
  });
});
