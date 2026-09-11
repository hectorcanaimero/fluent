import {
  isValidTimeZone,
  safeTimeZone,
  secondsUntilUserMidnight,
  turnsDayKey,
  userDay,
} from './user-day.js';

/** 2026-09-11T02:30:00Z = 2026-09-10 23:30 en Buenos Aires (UTC-3). */
const LATE_NIGHT_UTC = new Date('2026-09-11T02:30:00.000Z');

describe('userDay · día natural del aprendiz (MAL-23)', () => {
  it('usa la zona del perfil, no UTC', () => {
    expect(userDay('UTC', LATE_NIGHT_UTC)).toBe('2026-09-11');
    // Para quien está en Buenos Aires todavía es el día anterior: reiniciarle
    // el cupo a las 21:00 de su tarde sería el bug que esto evita.
    expect(userDay('America/Argentina/Buenos_Aires', LATE_NIGHT_UTC)).toBe('2026-09-10');
    expect(userDay('Asia/Tokyo', LATE_NIGHT_UTC)).toBe('2026-09-11');
  });

  it('cae a UTC con una zona que no existe', () => {
    expect(userDay('Marte/Olympus', LATE_NIGHT_UTC)).toBe(userDay('UTC', LATE_NIGHT_UTC));
    expect(userDay(null, LATE_NIGHT_UTC)).toBe(userDay('UTC', LATE_NIGHT_UTC));
    expect(userDay(undefined, LATE_NIGHT_UTC)).toBe(userDay('UTC', LATE_NIGHT_UTC));
  });
});

describe('secondsUntilUserMidnight (MAL-23)', () => {
  it('cuenta hasta la medianoche del usuario', () => {
    // 23:30 en Buenos Aires → media hora.
    expect(secondsUntilUserMidnight('America/Argentina/Buenos_Aires', LATE_NIGHT_UTC)).toBe(
      30 * 60,
    );
    // 02:30 en UTC → 21 h y media.
    expect(secondsUntilUserMidnight('UTC', LATE_NIGHT_UTC)).toBe(21 * 3600 + 30 * 60);
  });

  it('nunca devuelve 0 ni negativo', () => {
    const midnight = new Date('2026-09-11T00:00:00.000Z');
    expect(secondsUntilUserMidnight('UTC', midnight)).toBeGreaterThan(0);
  });

  it('cae a UTC con una zona inválida', () => {
    expect(secondsUntilUserMidnight('Marte/Olympus', LATE_NIGHT_UTC)).toBe(
      secondsUntilUserMidnight('UTC', LATE_NIGHT_UTC),
    );
  });
});

describe('helpers de zona horaria', () => {
  it('isValidTimeZone distingue zonas reales de inventadas', () => {
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Marte/Olympus')).toBe(false);
  });

  it('safeTimeZone devuelve UTC ante lo que no sirve', () => {
    expect(safeTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(safeTimeZone('')).toBe('UTC');
    expect(safeTimeZone(null)).toBe('UTC');
  });
});

describe('turnsDayKey', () => {
  it('es única por usuario y día', () => {
    expect(turnsDayKey('u-1', '2026-09-10')).toBe('turns:day:u-1:2026-09-10');
    expect(turnsDayKey('u-1', '2026-09-10')).not.toBe(turnsDayKey('u-2', '2026-09-10'));
    expect(turnsDayKey('u-1', '2026-09-10')).not.toBe(turnsDayKey('u-1', '2026-09-11'));
  });
});
