/**
 * Semana ISO (lunes 00:00 UTC), compartida por `GET /progress`
 * (`sessionsThisWeek`), `GET /leaderboard` y `GET /weekly-summary`
 * (SPEC-07 §5: «Semana ISO, lunes 00:00 UTC»).
 *
 * Función pura, sin dependencias de Nest, para poder testear los dos casos
 * de borde clásicos sin red ni base de datos (docs/specs/pendientes/PR-02.md):
 * un cambio de año y un domingo, que debe pertenecer a la semana que empezó
 * el lunes **anterior**, no a la que empieza el lunes siguiente.
 */

/** Formato exacto de `?week=` (SPEC-02 §4.5): fecha ISO `YYYY-MM-DD`, sin hora. */
const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Lunes 00:00 UTC de la semana ISO que contiene `date` (según su día de calendario UTC). */
export function mondayOfIsoWeekUtc(date: Date): Date {
  const utcMidnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay(): 0 = domingo … 6 = sábado. Se convierte a 1..7 (lunes..domingo)
  // para que un domingo (7) reste 6 días y caiga en el lunes anterior, nunca
  // en el siguiente.
  const isoWeekday = utcMidnight.getUTCDay() === 0 ? 7 : utcMidnight.getUTCDay();
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - (isoWeekday - 1));
  return utcMidnight;
}

/** `date` como `YYYY-MM-DD` (parte de fecha de un ISO 8601 en UTC). */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resuelve el `weekStart` (lunes 00:00 UTC) a partir del `?week=` opcional de
 * SPEC-02 §4.5. Sin parámetro, la semana en curso (`now`). `null` si
 * `weekParam` no tiene el formato `YYYY-MM-DD` o no es una fecha real (por
 * ejemplo `2024-02-30`): quien llama debe traducir eso a `400 VALIDATION`.
 */
export function resolveWeekStart(weekParam: string | undefined, now: Date = new Date()): string | null {
  if (weekParam === undefined) {
    return formatIsoDate(mondayOfIsoWeekUtc(now));
  }

  if (!WEEK_PARAM_PATTERN.test(weekParam)) {
    return null;
  }

  const parsed = new Date(`${weekParam}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // `Date` normaliza fechas imposibles (p. ej. 2024-02-30 -> 2024-03-01) en
  // vez de fallar: se compara el día de vuelta contra el string de entrada
  // para rechazar esos casos como formato inválido.
  if (formatIsoDate(parsed) !== weekParam) {
    return null;
  }

  return formatIsoDate(mondayOfIsoWeekUtc(parsed));
}
