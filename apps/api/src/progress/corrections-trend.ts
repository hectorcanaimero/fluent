/** Fila mínima de `corrections` (SPEC-01 §2.8) que necesita la agregación. */
export interface CorrectionTrendRow {
  readonly category: string;
  readonly created_at: string; // ISO 8601 timestamp
}

/** Elemento de `correctionsTrend[]` de `GET /progress` (SPEC-02 §4.5). */
export interface CorrectionTrendItem {
  readonly category: string;
  readonly count30d: number;
  readonly count7d: number;
}

/** Ventana "reciente" dentro de los 30 días ya traídos por el repositorio. */
const RECENT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Agrega filas de `corrections` por `category` en `{count30d, count7d}`
 * (`GET /progress`, SPEC-02 §4.5). PostgREST no hace `GROUP BY` cómodamente
 * (docs/specs/pendientes/PR-02.md), así que `CorrectionsRepository` trae las
 * filas ya acotadas a los últimos 30 días del usuario (`created_at >=
 * hace 30 días`) y esta función pura las agrega en TypeScript: mismo patrón
 * que `aggregateTokensBySession` de PR-02/T5
 * (`apps/api/src/models/session-usage.repository.ts`).
 *
 * `count30d` es simplemente el total de filas de cada categoría (ya vienen
 * acotadas a 30 días por el repositorio); `count7d` es el subconjunto con
 * `created_at` dentro de los últimos 7 días respecto de `now`.
 *
 * Orden del resultado: sin ninguna spec que lo fije, se ordena por
 * `count30d` descendente (las categorías con más correcciones primero, más
 * útil para el usuario) y, en empate, alfabético por `category` (determinista
 * para los tests).
 */
export function aggregateCorrectionsTrend(
  rows: readonly CorrectionTrendRow[],
  now: Date = new Date(),
): CorrectionTrendItem[] {
  const sevenDaysAgoMs = now.getTime() - RECENT_WINDOW_DAYS * DAY_MS;
  const totals = new Map<string, { count30d: number; count7d: number }>();

  for (const row of rows) {
    const createdAtMs = new Date(row.created_at).getTime();
    const entry = totals.get(row.category) ?? { count30d: 0, count7d: 0 };
    entry.count30d += 1;
    if (!Number.isNaN(createdAtMs) && createdAtMs >= sevenDaysAgoMs) {
      entry.count7d += 1;
    }
    totals.set(row.category, entry);
  }

  return [...totals.entries()]
    .map(([category, counts]) => ({ category, ...counts }))
    .sort((a, b) => b.count30d - a.count30d || a.category.localeCompare(b.category));
}
