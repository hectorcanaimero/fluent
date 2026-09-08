import { I18nService } from '../i18n/i18n.service.js';
import type { GroupAccessService } from './group-access.service.js';
import type { WeeklySummaryRepository } from './weekly-summary.repository.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

const NOW = new Date('2026-09-09T12:00:00.000Z'); // week start 2026-09-07

function createService(summary: unknown | null) {
  const groupAccess = {
    requireOwnGroup: vi
      .fn()
      .mockResolvedValue({ profile: { user_id: 'user-1' }, group: { id: 'group-1' }, locale: 'es' }),
  };
  const weeklySummaryRepository = {
    findByGroupAndWeek: vi.fn().mockResolvedValue(summary),
  };

  const service = new WeeklySummaryService(
    groupAccess as unknown as GroupAccessService,
    weeklySummaryRepository as unknown as WeeklySummaryRepository,
    new I18nService(),
  );

  return { service, groupAccess, weeklySummaryRepository };
}

describe('WeeklySummaryService.getWeeklySummary', () => {
  it('returns { text, weekStart } when a summary exists for that week', async () => {
    const { service, weeklySummaryRepository } = createService({
      text: 'Buena semana!',
      week_start: '2026-09-07',
    });

    const result = await service.getWeeklySummary('user-1', undefined, undefined, NOW);

    expect(result).toEqual({ text: 'Buena semana!', weekStart: '2026-09-07' });
    expect(weeklySummaryRepository.findByGroupAndWeek).toHaveBeenCalledWith('group-1', '2026-09-07');
  });

  it('throws 404 NOT_READY when there is no summary yet for that week', async () => {
    const { service } = createService(null);

    await expect(service.getWeeklySummary('user-1', undefined, undefined, NOW)).rejects.toMatchObject(
      { code: 'NOT_READY' },
    );
  });

  it('rejects a malformed ?week= with 400 VALIDATION', async () => {
    const { service } = createService(null);

    await expect(
      service.getWeeklySummary('user-1', '2024-02-30', undefined, NOW),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
