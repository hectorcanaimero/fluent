import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { ModelCatalogService } from '../../llm/catalog.service.js';
import {
  JOB_DAILY_STREAKS,
  JOB_MODEL_CATALOG,
  JOB_RETENTION,
  JOB_SESSION_SWEEPER,
} from '../jobs.constants.js';
import { NullSessionSweeper, type SessionSweeper } from '../session-sweeper.js';
import type { DailyStreaksService } from './daily-streaks.service.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import type { RetentionService } from './retention.service.js';

function makeJob(name: string): Job<Record<string, never>> {
  return {
    name,
    id: 'job-1',
    attemptsMade: 0,
    data: {},
  } as unknown as Job<Record<string, never>>;
}

describe('MaintenanceProcessor', () => {
  it('despacha session-sweeper al SessionSweeper inyectado (NullSessionSweeper) sin romper', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const sessionSweeper: SessionSweeper = new NullSessionSweeper();
    const dailyStreaksService = { run: vi.fn() } as unknown as DailyStreaksService;
    const retentionService = { run: vi.fn() } as unknown as RetentionService;
    const modelCatalogService = { refresh: vi.fn() } as unknown as ModelCatalogService;

    const processor = new MaintenanceProcessor(
      sessionSweeper,
      dailyStreaksService,
      retentionService,
      modelCatalogService,
    );

    const result = await processor.process(makeJob(JOB_SESSION_SWEEPER));

    expect(result).toEqual({ closedByHardCap: 0, closedAsAbandoned: 0, markedAbandoned: 0 });
    expect(dailyStreaksService.run).not.toHaveBeenCalled();
    expect(retentionService.run).not.toHaveBeenCalled();
    expect(modelCatalogService.refresh).not.toHaveBeenCalled();
  });

  it('despacha daily-streaks a DailyStreaksService.run', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const dailyStreaksResult = {
      graced: 1,
      reset: 0,
      groupsAdvanced: 1,
      groupsReset: 0,
      groupsSkipped: 0,
    };
    const dailyStreaksService = {
      run: vi.fn(async () => dailyStreaksResult),
    } as unknown as DailyStreaksService;

    const processor = new MaintenanceProcessor(
      new NullSessionSweeper(),
      dailyStreaksService,
      { run: vi.fn() } as unknown as RetentionService,
      { refresh: vi.fn() } as unknown as ModelCatalogService,
    );

    const result = await processor.process(makeJob(JOB_DAILY_STREAKS));

    expect(result).toEqual(dailyStreaksResult);
    expect(dailyStreaksService.run).toHaveBeenCalledTimes(1);
  });

  it('despacha retention a RetentionService.run', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const retentionResult = { llmCallsDeleted: 3, turnsDeleted: 5 };
    const retentionService = {
      run: vi.fn(async () => retentionResult),
    } as unknown as RetentionService;

    const processor = new MaintenanceProcessor(
      new NullSessionSweeper(),
      { run: vi.fn() } as unknown as DailyStreaksService,
      retentionService,
      { refresh: vi.fn() } as unknown as ModelCatalogService,
    );

    const result = await processor.process(makeJob(JOB_RETENTION));

    expect(result).toEqual(retentionResult);
    expect(retentionService.run).toHaveBeenCalledTimes(1);
  });

  it('despacha model-catalog a ModelCatalogService.refresh', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const modelCatalogService = {
      refresh: vi.fn(async () => undefined),
    } as unknown as ModelCatalogService;

    const processor = new MaintenanceProcessor(
      new NullSessionSweeper(),
      { run: vi.fn() } as unknown as DailyStreaksService,
      { run: vi.fn() } as unknown as RetentionService,
      modelCatalogService,
    );

    const result = await processor.process(makeJob(JOB_MODEL_CATALOG));

    expect(result).toEqual({ status: 'refreshed' });
    expect(modelCatalogService.refresh).toHaveBeenCalledTimes(1);
  });

  it('propaga el error de un job para que BullMQ reintente', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const retentionService = {
      run: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as unknown as RetentionService;

    const processor = new MaintenanceProcessor(
      new NullSessionSweeper(),
      { run: vi.fn() } as unknown as DailyStreaksService,
      retentionService,
      { refresh: vi.fn() } as unknown as ModelCatalogService,
    );

    await expect(processor.process(makeJob(JOB_RETENTION))).rejects.toThrow('boom');
  });

  it('lanza para un job.name desconocido', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const processor = new MaintenanceProcessor(
      new NullSessionSweeper(),
      { run: vi.fn() } as unknown as DailyStreaksService,
      { run: vi.fn() } as unknown as RetentionService,
      { refresh: vi.fn() } as unknown as ModelCatalogService,
    );

    await expect(processor.process(makeJob('unknown-job'))).rejects.toThrow(
      /job desconocido/,
    );
  });
});
