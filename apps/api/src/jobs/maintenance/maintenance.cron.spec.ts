import type { Queue } from 'bullmq';

import {
  JOB_DAILY_STREAKS,
  JOB_MODEL_CATALOG,
  JOB_RETENTION,
  JOB_SESSION_SWEEPER,
  JOB_STUDY_REMINDER,
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
  STUDY_REMINDER_ATTEMPTS,
  STUDY_REMINDER_CRON_PATTERN,
  STUDY_REMINDER_SCHEDULER_ID,
} from './maintenance.cron.js';

describe('MaintenanceCronRegistrar', () => {
  it('SPEC-05 §1 y F13.1.T2: los 5 patrones de cron son los esperados', () => {
    expect(SESSION_SWEEPER_CRON_PATTERN).toBe('* * * * *');
    expect(DAILY_STREAKS_CRON_PATTERN).toBe('30 3 * * *');
    expect(RETENTION_CRON_PATTERN).toBe('0 4 * * *');
    expect(MODEL_CATALOG_CRON_PATTERN).toBe('0 */6 * * *');
    expect(STUDY_REMINDER_CRON_PATTERN).toBe('0 * * * *');
  });

  it('registra los 5 job schedulers con patrón, tz UTC y attempts correctos', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;
    const registrar = new MaintenanceCronRegistrar(queue);

    await registrar.onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(5);
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
    expect(upsertJobScheduler).toHaveBeenNthCalledWith(
      5,
      STUDY_REMINDER_SCHEDULER_ID,
      { pattern: '0 * * * *', tz: 'UTC' },
      { name: JOB_STUDY_REMINDER, data: {}, opts: { attempts: STUDY_REMINDER_ATTEMPTS } },
    );

    expect(SESSION_SWEEPER_ATTEMPTS).toBe(1);
    expect(DAILY_STREAKS_ATTEMPTS).toBe(2);
    expect(RETENTION_ATTEMPTS).toBe(2);
    expect(MODEL_CATALOG_ATTEMPTS).toBe(3);
    expect(STUDY_REMINDER_ATTEMPTS).toBe(2);
  });

  it('reiniciar el registrador vuelve a llamar con los mismos argumentos (BullMQ deduplica por schedulerId)', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;

    await new MaintenanceCronRegistrar(queue).onModuleInit();
    await new MaintenanceCronRegistrar(queue).onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(10);
    const firstRun = upsertJobScheduler.mock.calls.slice(0, 5);
    const secondRun = upsertJobScheduler.mock.calls.slice(5, 10);
    expect(firstRun).toEqual(secondRun);
  });
});
