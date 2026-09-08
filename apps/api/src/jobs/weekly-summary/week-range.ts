/**
 * Cálculo de fechas del job `weekly-summary` (SPEC-05 §4, último párrafo).
 *
 * Funciones puras para poder probarlas sin BullMQ ni base de datos.
 */

/** `YYYY-MM-DD` en UTC de una fecha, sin hora. */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * SPEC-05 §4: «Se encola un job por grupo el lunes 07:00 UTC» con
 * `weekStart` = el lunes de la semana que **acaba de terminar**. El
 * disparador corre un lunes a las 07:00 UTC, así que esa semana empezó
 * exactamente 7 días antes de hoy.
 *
 * No se valida que `now` caiga en lunes: el disparador solo se registra con
 * el patrón cron `0 7 * * 1`, así que en producción siempre lo es. Esta
 * función solo resta 7 días naturales en UTC, sin ajustar día de la semana,
 * tal y como dice la spec literalmente ("weekStart = hoy - 7 días").
 */
export function computePreviousWeekStart(now: Date): string {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  today.setUTCDate(today.getUTCDate() - 7);
  return toDateOnly(today);
}

export interface WeekRangeUtc {
  /** Inicio de la semana, inclusive: `week_start` a las 00:00 UTC. */
  readonly startIso: string;
  /** Fin de la semana, exclusive: `week_start + 7` días a las 00:00 UTC. */
  readonly endIso: string;
}

/**
 * Mismo rango `[week_start 00:00 UTC, week_start+7 00:00 UTC)` que usa la
 * función SQL `weekly_leaderboard` (migración
 * `20260908191927_noticias-y-social.sql`), para que "top 3 temas por
 * miembro" cuente exactamente las mismas sesiones que XP y sesiones de la
 * semana.
 */
export function weekRangeUtc(weekStart: string): WeekRangeUtc {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
