import { resolveWeekStart, weekStartToDate } from './iso-week.js';

/**
 * El cálculo de la semana ISO (lunes, cambio de año, domingo, bisiesto) se
 * prueba en `src/game/iso-week.spec.ts`, que es donde vive desde que se
 * fusionó PR-07 (PEND-71). Aquí solo queda el parseo de `?week=`.
 */

describe('resolveWeekStart', () => {
  const now = new Date('2026-09-09T10:00:00.000Z'); // Wednesday

  it('without a param, resolves the Monday of the current week', () => {
    expect(resolveWeekStart(undefined, now)).toBe('2026-09-07');
  });

  it('with a Monday param, resolves to itself', () => {
    expect(resolveWeekStart('2026-08-31', now)).toBe('2026-08-31');
  });

  it('with a Sunday param, resolves to the Monday before it', () => {
    expect(resolveWeekStart('2023-01-01', now)).toBe('2022-12-26');
  });

  it('resolves correctly across a year boundary', () => {
    expect(resolveWeekStart('2023-12-31', now)).toBe('2023-12-25');
    expect(resolveWeekStart('2024-01-01', now)).toBe('2024-01-01');
  });

  it('rejects a malformed date -> null', () => {
    expect(resolveWeekStart('not-a-date', now)).toBeNull();
    expect(resolveWeekStart('2026-9-7', now)).toBeNull();
    expect(resolveWeekStart('2026-09-07T00:00:00Z', now)).toBeNull();
  });

  it('rejects a calendar-invalid date -> null', () => {
    expect(resolveWeekStart('2024-02-30', now)).toBeNull();
    expect(resolveWeekStart('2026-13-01', now)).toBeNull();
  });
});

describe('weekStartToDate', () => {
  it('convierte el lunes YYYY-MM-DD en su instante UTC', () => {
    expect(weekStartToDate('2026-09-07').toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });
});
