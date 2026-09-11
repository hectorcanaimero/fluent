import type { CorrectionCategory } from '../db/schema.js';
import type { GraceStatus } from '../game/progress.service.js';

/** `level` de `GET /progress` (SPEC-02 §4.5, SPEC-07 §1). */
export interface LevelInfo {
  readonly name: string;
  readonly min: number;
  /** `minXp` del siguiente nivel, o `null` en el último (`Native-ish`). */
  readonly next: number | null;
}

/** Elemento de `correctionsTrend[]` de `GET /progress` (SPEC-02 §4.5). */
export interface CorrectionTrendItem {
  readonly category: CorrectionCategory;
  readonly count30d: number;
  readonly count7d: number;
}

/**
 * Respuesta de `GET /progress` (SPEC-02 §4.5). Nombres de campo exactamente
 * como espera `apps/mobile/lib/core/api/models.dart::ProgressResult` (no se
 * toca ese archivo).
 *
 * El cálculo lo hace `ProgressService` de `src/game/` (PR-07/T1); aquí solo
 * vive la forma del JSON y la traducción (`progress.mapper.ts`).
 */
export interface ProgressResultDto {
  readonly xp: number;
  readonly level: LevelInfo;
  readonly streak: number;
  readonly longestStreak: number;
  readonly sessionsThisWeek: number;
  readonly correctionsTrend: CorrectionTrendItem[];
  /**
   * Comodín de racha de la semana ISO en curso (MAL-27): `'available'` si
   * todavía queda, `'used'` si ya se gastó. Sin esto la app no podía
   * explicar por qué una racha sobrevivió a un día sin sesión, ni avisar de
   * que el de esta semana ya no está.
   */
  readonly grace: GraceStatus;
}
