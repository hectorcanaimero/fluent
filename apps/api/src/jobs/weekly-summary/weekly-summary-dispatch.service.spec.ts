import { JOB_WEEKLY_SUMMARY } from '../jobs.constants.js';
import { WeeklySummaryDispatchService } from './weekly-summary-dispatch.service.js';
import type { WeeklySummaryRepository } from './weekly-summary.repository.js';

function makeRepository(groupIds: string[]) {
  return { listGroupIds: vi.fn(async () => groupIds) };
}

function makeQueue() {
  return { add: vi.fn(async () => ({})) };
}

describe('WeeklySummaryDispatchService (SPEC-05 §4, último párrafo)', () => {
  it('encola un job por grupo con weekStart = hoy - 7 días y jobId estable', async () => {
    const repository = makeRepository(['g1', 'g2']);
    const queue = makeQueue();
    const service = new WeeklySummaryDispatchService(
      repository as unknown as WeeklySummaryRepository,
      queue as never,
    );

    // Lunes 2026-09-14 07:00 UTC: la semana que acaba de terminar empezó el
    // lunes anterior, 2026-09-07.
    const now = new Date('2026-09-14T07:00:00.000Z');
    const result = await service.run(now);

    expect(result).toEqual({ weekStart: '2026-09-07', groupsEnqueued: 2 });
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith(
      JOB_WEEKLY_SUMMARY,
      { groupId: 'g1', weekStart: '2026-09-07' },
      { jobId: 'g1-2026-09-07' },
    );
    expect(queue.add).toHaveBeenCalledWith(
      JOB_WEEKLY_SUMMARY,
      { groupId: 'g2', weekStart: '2026-09-07' },
      { jobId: 'g2-2026-09-07' },
    );
  });

  it('sin grupos, no encola nada', async () => {
    const repository = makeRepository([]);
    const queue = makeQueue();
    const service = new WeeklySummaryDispatchService(
      repository as unknown as WeeklySummaryRepository,
      queue as never,
    );

    const result = await service.run(new Date('2026-09-14T07:00:00.000Z'));

    expect(result).toEqual({ weekStart: '2026-09-07', groupsEnqueued: 0 });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
