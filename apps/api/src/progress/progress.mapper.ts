import type { ProgressSummary } from '../game/progress.service.js';
import type { CorrectionTrendItem, ProgressResultDto } from './progress.types.js';

/**
 * Traduce el `ProgressSummary` de `src/game/progress.service.ts` (PR-07/T1) al
 * cuerpo exacto de `GET /progress` (SPEC-02 §4.5).
 *
 * Existe porque los dos contratos no coinciden y el que manda es el de la app
 * (`apps/mobile/lib/core/api/models.dart::ProgressResult`, que no se toca):
 *
 * - `level`: `{current, next, xpToNext}` (objetos `XpLevel`) -> `{name, min,
 *   next}`, donde `next` es el `minXp` del siguiente nivel o `null` en el
 *   último.
 * - `correctionsTrend`: `{last7, last30}` -> `{count7d, count30d}`, y además
 *   se ordena: SPEC-02 §4.5 no fija el orden, así que se mantiene el criterio
 *   que ya traía PR-02/T7 (más correcciones primero; a igualdad, alfabético
 *   por categoría, para que sea determinista en los tests).
 * - `grace`: se calcula en `src/game/` pero **no** se expone. Ni SPEC-02 §4.5
 *   ni `ProgressResult` de la app tienen ese campo; añadirlo sería inventar
 *   contrato. Ver docs/specs/pendientes/PR-02.md PEND-71.
 */
export function toProgressResultDto(summary: ProgressSummary): ProgressResultDto {
  const correctionsTrend: CorrectionTrendItem[] = summary.correctionsTrend
    .map((entry) => ({
      category: entry.category,
      count30d: entry.last30,
      count7d: entry.last7,
    }))
    .sort((a, b) => b.count30d - a.count30d || a.category.localeCompare(b.category));

  return {
    xp: summary.xp,
    level: {
      name: summary.level.current.name,
      min: summary.level.current.minXp,
      next: summary.level.next?.minXp ?? null,
    },
    streak: summary.streak,
    longestStreak: summary.longestStreak,
    sessionsThisWeek: summary.sessionsThisWeek,
    correctionsTrend,
  };
}
