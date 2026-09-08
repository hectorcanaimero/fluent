import type { Queue } from 'bullmq';

import { JOB_RSS_INGEST } from '../jobs.constants.js';
import {
  RSS_INGEST_CRON_JOB_ID,
  RSS_INGEST_CRON_PATTERN,
  RssIngestCronService,
} from './rss-ingest.cron.js';

describe('RssIngestCronService', () => {
  it('registra el job scheduler con el patrón, tz y jobSchedulerId de SPEC-05 §1', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;
    const service = new RssIngestCronService(queue);

    await service.onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'cron-rss-ingest',
      { pattern: '0 6 * * *', tz: 'UTC' },
      { name: JOB_RSS_INGEST, data: {} },
    );
    expect(RSS_INGEST_CRON_PATTERN).toBe('0 6 * * *');
    expect(RSS_INGEST_CRON_JOB_ID).toBe('cron-rss-ingest');
  });

  it('reiniciar el servicio vuelve a llamar a upsertJobScheduler con los mismos argumentos (BullMQ deduplica)', async () => {
    const upsertJobScheduler = vi.fn(async () => ({}) as never);
    const queue = { upsertJobScheduler } as unknown as Queue;

    await new RssIngestCronService(queue).onModuleInit();
    await new RssIngestCronService(queue).onModuleInit();

    expect(upsertJobScheduler).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = upsertJobScheduler.mock.calls;
    expect(firstCall).toEqual(secondCall);
  });
});
