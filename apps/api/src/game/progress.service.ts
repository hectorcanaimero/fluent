/**
 * Progreso y niveles del usuario (SPEC-07 §1, §3; docs/tasks/PR-07-gamificacion-y-social.md T1).
 *
 * Clase pura, sin `@Injectable` ni módulo de NestJS: sigue el mismo patrón que
 * `LlmService` (apps/api/src/llm/llm.service.ts). El repositorio se recibe por
 * constructor como una interfaz; PR-02/T7 implementará `ProgressRepository`
 * contra InsForge (tabla `sessions` y `corrections` con el cliente admin) y lo
 * conectará a NestJS. Los tests usan un repositorio simulado en memoria.
 */
import type { CorrectionCategory } from '../db/schema.js';
import { XP_LEVELS, type XpLevel } from '../config/product.js';
import { isoDateString, mondayUtcOf } from './iso-week.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CORRECTIONS_TREND_DAYS = 30;
const CORRECTIONS_RECENT_DAYS = 7;

/** Progreso de XP dentro de la escalera de niveles (SPEC-07 §1, RF-5.4). */
export interface XpLevelProgress {
  readonly current: XpLevel;
  readonly next: XpLevel | null;
  /** `next.minXp - xp`, o `null` si ya está en el nivel máximo. */
  readonly xpToNext: number | null;
}

/**
 * Nivel actual y siguiente para una cantidad de XP dada (SPEC-07 §1).
 *
 * Pura: no toca el repositorio. `XP_LEVELS` ya viene ordenado ascendente por
 * `minXp` (ver apps/api/src/config/product.ts). Un `xp` negativo (no debería
 * ocurrir, pero no se valida aquí) se trata como el nivel más bajo (Newcomer).
 */
export function levelFor(xp: number): XpLevelProgress {
  // Un xp negativo no debería ocurrir (invariante de `profiles.xp`), pero si
  // pasara se trata como si el usuario estuviera en 0 a efectos de elegir
  // nivel actual/siguiente; `xpToNext` sí usa el `xp` real, así que refleja la
  // distancia completa hasta el siguiente nivel.
  const effectiveXp = Math.max(0, xp);

  let current: XpLevel = XP_LEVELS[0]!;
  let next: XpLevel | null = null;

  for (const level of XP_LEVELS) {
    if (level.minXp <= effectiveXp) {
      current = level;
    } else {
      next = level;
      break;
    }
  }

  return {
    current,
    next,
    xpToNext: next === null ? null : next.minXp - xp,
  };
}

/**
 * Estado de la gracia semanal de streak (SPEC-07 §3).
 * 'used': ya se usó la gracia disponible esta semana ISO.
 * 'available': todavía no se usó.
 */
export type GraceStatus = 'available' | 'used';

/** Conteo de correcciones de una categoría en los últimos 7 y 30 días. */
export interface CorrectionTrendEntry {
  readonly category: CorrectionCategory;
  readonly last7: number;
  readonly last30: number;
}

/** Fila de `profiles` que necesita `ProgressService`, ya traducida a camelCase. */
export interface ProgressProfileRow {
  readonly xp: number;
  /** `profiles.streak`: días consecutivos con sesión válida (SPEC-07 §3). */
  readonly streak: number;
  /** `profiles.longest_streak`: récord histórico de `streak`. */
  readonly longestStreak: number;
  readonly timezone: string;
  /**
   * Lunes ('YYYY-MM-DD') de la semana en que se usó la gracia, o `null` si nunca
   * se usó (columna `profiles.grace_used_week`, SPEC-01 §2.1).
   */
  readonly graceUsedWeek: string | null;
}

/** Fila de `corrections` que necesita `ProgressService`, ya traducida a camelCase. */
export interface ProgressCorrectionRow {
  readonly category: CorrectionCategory;
  /** ISO 8601 timestamp (columna `corrections.created_at`). */
  readonly createdAt: string;
}

/**
 * Repositorio simulado que necesita `ProgressService`. PR-02/T7 implementará esta
 * interfaz contra InsForge con el cliente admin; en tests se usa una
 * implementación en memoria (ver progress.service.spec.ts).
 *
 * "Sesión válida" (SPEC-07 §2) = fila de `sessions` con `status = 'ended' AND
 * xp_earned > 0`.
 *
 * `sinceIso` en ambos métodos es un timestamp ISO 8601 completo (el resultado de
 * `Date#toISOString()`), no solo una fecha: así la implementación real puede
 * filtrar directamente `created_at >= sinceIso` (o `ended_at >= sinceIso`) sin
 * ambigüedad de hora. Ver docs/specs/pendientes/PR-07.md.
 */
export interface ProgressRepository {
  getProfile(userId: string): Promise<ProgressProfileRow>;
  /** Cuenta sesiones válidas del usuario con `ended_at >= sinceIso` (o equivalente). */
  countValidSessionsSince(userId: string, sinceIso: string): Promise<number>;
  /** Devuelve las correcciones del usuario con `created_at >= sinceIso`. */
  getCorrectionsSince(userId: string, sinceIso: string): Promise<ProgressCorrectionRow[]>;
}

/** Resumen de progreso que consume la pantalla de Home (RF-5.1 a RF-5.4). */
export interface ProgressSummary {
  /** `profiles.xp` tal cual, el mismo con el que se resolvió `level`. */
  readonly xp: number;
  readonly level: XpLevelProgress;
  readonly streak: number;
  readonly longestStreak: number;
  readonly sessionsThisWeek: number;
  readonly correctionsTrend: readonly CorrectionTrendEntry[];
  readonly grace: GraceStatus;
}

export class ProgressService {
  constructor(private readonly repo: ProgressRepository) {}

  /**
   * Resumen de progreso del usuario en el momento `now` (por defecto, ahora).
   *
   * - `sessionsThisWeek`: sesiones válidas desde el lunes 00:00 UTC de la semana
   *   ISO de `now` (SPEC-07 §5, mismo criterio que el leaderboard).
   * - `correctionsTrend`: agrupa por categoría las correcciones de los últimos
   *   30 días, contando cuántas caen además en los últimos 7. Solo incluye
   *   categorías con al menos una corrección en esos 30 días.
   * - `grace`: 'used' si `grace_used_week` coincide con el lunes UTC de la
   *   semana de `now` (ver docs/specs/pendientes/PR-07.md — se compara contra
   *   UTC, no contra `profile.timezone`).
   * - `xp`, `streak` y `longestStreak`: pasan tal cual desde `profiles`. Los
   *   añadió PR-02 al fusionar (docs/specs/pendientes/PR-02.md PEND-71):
   *   `GET /progress` los devuelve (`apps/mobile/lib/core/api/models.dart`
   *   `ProgressResult`) y sin ellos el controlador tendría que volver a leer
   *   el perfil que este servicio ya pide.
   */
  async getProgress(userId: string, now: Date = new Date()): Promise<ProgressSummary> {
    const profile = await this.repo.getProfile(userId);
    const level = levelFor(profile.xp);

    const weekStart = mondayUtcOf(now);
    const sessionsThisWeek = await this.repo.countValidSessionsSince(
      userId,
      weekStart.toISOString(),
    );

    const trendSince = new Date(now.getTime() - CORRECTIONS_TREND_DAYS * MS_PER_DAY);
    const recentSince = new Date(now.getTime() - CORRECTIONS_RECENT_DAYS * MS_PER_DAY);
    const corrections = await this.repo.getCorrectionsSince(userId, trendSince.toISOString());
    const correctionsTrend = summarizeCorrectionsTrend(corrections, recentSince);

    const grace: GraceStatus =
      profile.graceUsedWeek === isoDateString(weekStart) ? 'used' : 'available';

    return {
      xp: profile.xp,
      level,
      streak: profile.streak,
      longestStreak: profile.longestStreak,
      sessionsThisWeek,
      correctionsTrend,
      grace,
    };
  }
}

/**
 * Agrupa `corrections` (ya filtradas por el repositorio a los últimos 30 días)
 * por categoría, contando cuántas tienen `createdAt >= recentSince` (last7) y
 * cuántas en total (last30). Solo aparecen categorías con al menos una fila.
 */
function summarizeCorrectionsTrend(
  corrections: readonly ProgressCorrectionRow[],
  recentSince: Date,
): CorrectionTrendEntry[] {
  const counts = new Map<CorrectionCategory, { last7: number; last30: number }>();

  for (const correction of corrections) {
    const entry = counts.get(correction.category) ?? { last7: 0, last30: 0 };
    entry.last30 += 1;
    if (new Date(correction.createdAt).getTime() >= recentSince.getTime()) {
      entry.last7 += 1;
    }
    counts.set(correction.category, entry);
  }

  return Array.from(counts.entries()).map(([category, { last7, last30 }]) => ({
    category,
    last7,
    last30,
  }));
}
