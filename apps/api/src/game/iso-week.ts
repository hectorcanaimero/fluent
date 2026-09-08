/**
 * Utilidad de semana ISO 8601 (lunes a domingo), compartida por `ProgressService`
 * (SPEC-07 §3, `grace_used_week`) y por `LeaderboardService` (SPEC-07 §5, "Semana
 * ISO, lunes 00:00 UTC").
 *
 * Todo el cálculo se hace en UTC: se ignora la hora local de la máquina y la del
 * usuario. `ProgressService` decide contra qué zona compara cada campo (ver
 * docs/specs/pendientes/PR-07.md).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Devuelve un `Date` en el lunes 00:00:00.000 UTC de la semana ISO que contiene
 * `date`. La semana ISO empieza el lunes: si `date` cae en domingo, su lunes es 6
 * días antes (no el lunes siguiente).
 *
 * `Date#getUTCDay()` devuelve 0 para domingo y 1-6 para lunes-sábado. Se convierte
 * a "días desde el lunes" con `(getUTCDay() + 6) % 7` (domingo -> 6, lunes -> 0,
 * ..., sábado -> 5) y se resta ese número de días, en UTC, para no arrastrar
 * ningún desfase de zona horaria local.
 */
export function mondayUtcOf(date: Date): Date {
  const utcMidnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (utcMidnight.getUTCDay() + 6) % 7;
  return new Date(utcMidnight.getTime() - daysSinceMonday * MS_PER_DAY);
}

/** Formatea `date` como `YYYY-MM-DD` en UTC (sin hora). */
export function isoDateString(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
