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
 * - `grace`: `'available' | 'used'` según `profiles.grace_used_week` frente al
 *   lunes de la semana ISO en curso. El cálculo ya vivía en `src/game/` pero
 *   no se exponía (PEND-71); MAL-27 lo saca, porque la app no tenía forma de
 *   explicar por qué una racha sobrevivió a un día sin sesión ni de avisar de
 *   que el comodín de esta semana ya se gastó.
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
    grace: summary.grace,
  };
}
