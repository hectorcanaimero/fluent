import { computePreviousWeekStart, weekRangeUtc } from './week-range.js';

describe('computePreviousWeekStart (SPEC-05 §4)', () => {
  it('calcula el lunes anterior como hoy - 7 días, en UTC', () => {
    // 2026-09-14 es lunes; el disparador corre ese día a las 07:00 UTC y debe
    // encolar la semana que acaba de terminar: 2026-09-07.
    const now = new Date('2026-09-14T07:00:00.000Z');
    expect(computePreviousWeekStart(now)).toBe('2026-09-07');
  });

  it('no depende de la hora del día, solo de la fecha en UTC', () => {
    const now = new Date('2026-09-14T23:59:59.999Z');
    expect(computePreviousWeekStart(now)).toBe('2026-09-07');
  });

  it('cruza correctamente un cambio de mes', () => {
    const now = new Date('2026-03-02T07:00:00.000Z');
    expect(computePreviousWeekStart(now)).toBe('2026-02-23');
  });
});

describe('weekRangeUtc (SPEC-05 §4, mismo criterio que weekly_leaderboard)', () => {
  it('devuelve [week_start 00:00 UTC, week_start+7 00:00 UTC)', () => {
    const range = weekRangeUtc('2026-09-07');
    expect(range.startIso).toBe('2026-09-07T00:00:00.000Z');
    expect(range.endIso).toBe('2026-09-14T00:00:00.000Z');
  });
});
