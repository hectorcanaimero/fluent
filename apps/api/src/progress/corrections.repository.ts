import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES, type CorrectionCategory } from '../db/schema.js';

/**
 * Fila mínima de `corrections` (SPEC-01 §2.8) que necesita la tendencia de
 * `GET /progress`. Vivía en `corrections-trend.ts`, que se borró al fusionar
 * PR-07: la agregación la hace ahora `ProgressService` de `src/game/`
 * (docs/specs/pendientes/PR-02.md PEND-71).
 */
export interface CorrectionTrendRow {
  readonly category: CorrectionCategory;
  readonly created_at: string; // ISO 8601 timestamp
}

/**
 * Días hacia atrás que trae `listRecentForTrend` (`correctionsTrend` de
 * `GET /progress`, SPEC-02 §4.5): son los 30 días del propio nombre del
 * campo (`count30d`), no una constante de SPEC-07 §1 (esa sección no habla
 * de correcciones), así que se queda local en vez de ir a `config/product.ts`
 * — ver docs/specs/pendientes/PR-02.md.
 */
export const CORRECTIONS_TREND_LOOKBACK_DAYS = 30;

/**
 * Límite de filas que trae `listRecentForTrend`: acotado por usuario y por
 * los 30 días de la ventana, pero con un tope explícito (documentado, como
 * pide el alcance de T7) para que un usuario con una actividad fuera de lo
 * común nunca dispare una consulta sin límite.
 */
export const CORRECTIONS_TREND_ROW_LIMIT = 3000;

/**
 * Repositorio de solo lectura de `corrections` (SPEC-01 §2.8) para
 * `GET /progress` (`correctionsTrend`). Lo consume
 * `InsforgeProgressRepository`, que implementa el `ProgressRepository` que
 * espera `src/game/progress.service.ts`.
 */
@Injectable()
export class CorrectionsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Filas de `corrections` del usuario desde `sinceIso`, solo
   * `category`/`created_at` (lo mínimo que necesita la agregación de
   * `src/game/progress.service.ts`). El servicio pide siempre los últimos
   * `CORRECTIONS_TREND_LOOKBACK_DAYS` días.
   */
  async listRecentForTrend(userId: string, sinceIso: string): Promise<CorrectionTrendRow[]> {
    const result = await this.admin.database
      .from(TABLES.corrections)
      .select('category, created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(CORRECTIONS_TREND_ROW_LIMIT);

    return unwrapInsforge<CorrectionTrendRow[]>(result) ?? [];
  }
}
