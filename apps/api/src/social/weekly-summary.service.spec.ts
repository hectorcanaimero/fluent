import { I18nService } from '../i18n/i18n.service.js';
import type { GroupAccessService } from './group-access.service.js';
import type { WeeklySummaryRepository } from './weekly-summary.repository.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

const NOW = new Date('2026-09-09T12:00:00.000Z'); // week start 2026-09-07

const ES_FOOTER = '— Fluent · practicá inglés con tus amigos';
const PT_FOOTER = '— Fluent · pratique inglês com seus amigos';

function createService(summary: unknown | null, locale: 'es' | 'pt-BR' = 'es') {
  const groupAccess = {
    requireOwnGroup: vi
      .fn()
      .mockResolvedValue({ profile: { user_id: 'user-1' }, group: { id: 'group-1' }, locale }),
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

    expect(result).toEqual({
      text: `Buena semana!\n\n${ES_FOOTER}`,
      weekStart: '2026-09-07',
    });
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

describe('WeeklySummaryService.getWeeklySummary · pie de marca (MEJ-41)', () => {
  it('añade el pie a un resumen guardado antes de MEJ-41', async () => {
    const { service } = createService({ text: 'Buena semana!', week_start: '2026-09-07' });

    const result = await service.getWeeklySummary('user-1', undefined, undefined, NOW);

    expect(result.text.endsWith(ES_FOOTER)).toBe(true);
  });

  it('no lo duplica en un resumen que ya lo trae', async () => {
    const { service } = createService({
      text: `Buena semana!\n\n${ES_FOOTER}`,
      week_start: '2026-09-07',
    });

    const result = await service.getWeeklySummary('user-1', undefined, undefined, NOW);

    expect(result.text).toBe(`Buena semana!\n\n${ES_FOOTER}`);
    expect(result.text.split('Fluent')).toHaveLength(2);
  });

  it('usa el pie del idioma del grupo', async () => {
    const { service } = createService(
      { text: 'Boa semana!', week_start: '2026-09-07' },
      'pt-BR',
    );

    const result = await service.getWeeklySummary('user-1', undefined, undefined, NOW);

    expect(result.text).toBe(`Boa semana!\n\n${PT_FOOTER}`);
  });
});
