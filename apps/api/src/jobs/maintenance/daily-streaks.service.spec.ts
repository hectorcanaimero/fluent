import type { ApplyStreakGraceResult, UpdateGroupStreaksResult } from '../../db/rpc.js';
import { DailyStreaksService } from './daily-streaks.service.js';
import { MaintenanceRepository } from './maintenance.repository.js';

function makeRepository(
  grace: ApplyStreakGraceResult,
  groups: UpdateGroupStreaksResult,
): { repository: MaintenanceRepository; calls: string[] } {
  const calls: string[] = [];
  const repository: MaintenanceRepository = {
    applyStreakGrace: vi.fn(async () => {
      calls.push('applyStreakGrace');
      return grace;
    }),
    updateGroupStreaks: vi.fn(async () => {
      calls.push('updateGroupStreaks');
      return groups;
    }),
    deleteLlmCallsOlderThan: vi.fn(async () => 0),
    deleteTurnsForSessionsStartedBefore: vi.fn(async () => 0),
  };
  return { repository, calls };
}

describe('DailyStreaksService', () => {
  it('llama apply_streak_grace y update_group_streaks en ese orden', async () => {
    const { repository, calls } = makeRepository(
      { graced: 1, reset: 2 },
      { advanced: 3, reset: 4, skipped: 5 },
    );
    const service = new DailyStreaksService(repository);

    await service.run();

    expect(calls).toEqual(['applyStreakGrace', 'updateGroupStreaks']);
  });

  it('agrega el resultado de ambas RPC', async () => {
    const { repository } = makeRepository(
      { graced: 1, reset: 2 },
      { advanced: 3, reset: 4, skipped: 5 },
    );
    const service = new DailyStreaksService(repository);

    const result = await service.run();

    expect(result).toEqual({
      graced: 1,
      reset: 2,
      groupsAdvanced: 3,
      groupsReset: 4,
      groupsSkipped: 5,
    });
  });
});
