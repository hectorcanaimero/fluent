import { isoDateString, mondayUtcOf } from './iso-week.js';

/** Construye un `Date` a partir de un timestamp UTC, con hora opcional (para
 * comprobar que la hora del día no afecta al cálculo). */
function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('mondayUtcOf / isoDateString', () => {
  it('un lunes exacto devuelve el mismo día a medianoche UTC', () => {
    // 2026-09-07 es lunes.
    const monday = mondayUtcOf(utc('2026-09-07'));
    expect(isoDateString(monday)).toBe('2026-09-07');
    expect(monday.getUTCHours()).toBe(0);
    expect(monday.getUTCMinutes()).toBe(0);
    expect(monday.getUTCSeconds()).toBe(0);
    expect(monday.getUTCMilliseconds()).toBe(0);
  });

  it('un domingo pertenece a la semana que empezó el lunes anterior (6 días antes)', () => {
    // 2026-09-06 es domingo; su lunes es 2026-08-31, no el 2026-09-07 siguiente.
    const monday = mondayUtcOf(utc('2026-09-06'));
    expect(isoDateString(monday)).toBe('2026-08-31');
  });

  it('un día intermedio de la semana (miércoles) redondea al lunes de esa semana', () => {
    // 2026-09-09 es miércoles.
    const monday = mondayUtcOf(utc('2026-09-09'));
    expect(isoDateString(monday)).toBe('2026-09-07');
  });

  it('cambio de año: 2027-01-01 (viernes) pertenece a la semana ISO que empezó en 2026', () => {
    const monday = mondayUtcOf(utc('2027-01-01'));
    expect(isoDateString(monday)).toBe('2026-12-28');
  });

  it('cambio de año: un domingo de fin de año cae en la semana que empezó el lunes anterior', () => {
    // 2023-01-01 es domingo; pertenece a la última semana ISO de 2022.
    const monday = mondayUtcOf(utc('2023-01-01'));
    expect(isoDateString(monday)).toBe('2022-12-26');
  });

  it('año bisiesto: el 29 de febrero de 2024 (jueves) cae en la semana del 26 de febrero', () => {
    const monday = mondayUtcOf(utc('2024-02-29'));
    expect(isoDateString(monday)).toBe('2024-02-26');
  });

  it('año bisiesto: un domingo de marzo cae en la semana ISO de febrero (cruza el mes)', () => {
    // 2024-03-03 es domingo; su lunes es 2024-02-26, cruzando de marzo a febrero.
    const monday = mondayUtcOf(utc('2024-03-03'));
    expect(isoDateString(monday)).toBe('2024-02-26');
  });

  it('la hora del día de entrada no afecta al resultado', () => {
    const morning = mondayUtcOf(new Date('2026-09-09T03:15:00.000Z'));
    const night = mondayUtcOf(new Date('2026-09-09T23:59:59.999Z'));
    expect(isoDateString(morning)).toBe('2026-09-07');
    expect(isoDateString(night)).toBe('2026-09-07');
  });

  it('isoDateString formatea con ceros a la izquierda', () => {
    expect(isoDateString(utc('2026-01-05'))).toBe('2026-01-05');
  });
});
