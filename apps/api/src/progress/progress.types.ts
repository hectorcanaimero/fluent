import type { LevelInfo } from './level.js';
import type { CorrectionTrendItem } from './corrections-trend.js';

/**
 * Respuesta de `GET /progress` (SPEC-02 §4.5). Nombres de campo exactamente
 * como espera `apps/mobile/lib/core/api/models.dart::ProgressResult` (no se
 * toca ese archivo).
 */
export interface ProgressResultDto {
  readonly xp: number;
  readonly level: LevelInfo;
  readonly streak: number;
  readonly longestStreak: number;
  readonly sessionsThisWeek: number;
  readonly correctionsTrend: CorrectionTrendItem[];
}
