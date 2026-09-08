/**
 * Parseo del parámetro `?week=` de SPEC-02 §4.5 (`GET /leaderboard`,
 * `GET /weekly-summary`).
 *
 * El cálculo de la semana ISO **no** vive aquí: lo hacen `mondayUtcOf` e
 * `isoDateString` de `src/game/iso-week.ts` (PR-07), que es la única
 * implementación del repo. Este módulo solo añade lo que es de la capa HTTP y
 * PR-07 no necesita: validar el string que manda el cliente. Al fusionar
 * PR-07 se borraron de aquí `mondayOfIsoWeekUtc` y `formatIsoDate`, que
 * duplicaban esas dos funciones (docs/specs/pendientes/PR-02.md PEND-71).
 */
import { isoDateString, mondayUtcOf } from '../game/iso-week.js';

/** Formato exacto de `?week=` (SPEC-02 §4.5): fecha ISO `YYYY-MM-DD`, sin hora. */
const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resuelve el `weekStart` (lunes 00:00 UTC) a partir del `?week=` opcional de
 * SPEC-02 §4.5. Sin parámetro, la semana en curso (`now`). `null` si
 * `weekParam` no tiene el formato `YYYY-MM-DD` o no es una fecha real (por
 * ejemplo `2024-02-30`): quien llama debe traducir eso a `400 VALIDATION`.
 */
export function resolveWeekStart(
  weekParam: string | undefined,
  now: Date = new Date(),
): string | null {
  if (weekParam === undefined) {
    return isoDateString(mondayUtcOf(now));
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
  if (isoDateString(parsed) !== weekParam) {
    return null;
  }

  return isoDateString(mondayUtcOf(parsed));
}

/**
 * `weekStart` (`YYYY-MM-DD`) como instante UTC. Es lo que se le pasa como
 * `now` a los servicios de `src/game/`, que reciben una fecha y calculan el
 * lunes de su semana: el lunes de la semana de un lunes es él mismo.
 */
export function weekStartToDate(weekStart: string): Date {
  return new Date(`${weekStart}T00:00:00.000Z`);
}
