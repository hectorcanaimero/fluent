/**
 * Leaderboard semanal y streak grupal (SPEC-07 §5, §6; docs/tasks/PR-07-gamificacion-y-social.md T4).
 *
 * Clase pura, sin `@Injectable` ni módulo de NestJS: sigue el mismo patrón que
 * `ProgressService`, `ChallengesService` y `BossService`
 * (apps/api/src/game/). El repositorio se recibe por constructor como una
 * interfaz; PR-02/T7 implementará `LeaderboardRepository` contra InsForge
 * (RPC `weekly_leaderboard` y tabla `groups`). Los tests usan una
 * implementación en memoria (ver leaderboard.service.spec.ts).
 *
 * Decisiones sin spec: ver docs/specs/pendientes/PR-07.md, sección "T4".
 */
import type { WeeklyLeaderboardEntry } from '../db/rpc.js';
import { isoDateString, mondayUtcOf } from './iso-week.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Repositorio simulado que necesita `LeaderboardService`. PR-02/T7
 * implementará esta interfaz contra InsForge (RPC y tabla `groups`); en
 * tests se usa una implementación en memoria (ver
 * leaderboard.service.spec.ts).
 */
export interface LeaderboardRepository {
  /**
   * Invoca la RPC `weekly_leaderboard(p_group_id, p_week_start)`.
   * `weekStart` es 'YYYY-MM-DD' (lunes UTC), igual que espera la RPC
   * (p_week_start es tipo `date` en SQL, no `timestamptz`).
   */
  weeklyLeaderboard(groupId: string, weekStart: string): Promise<WeeklyLeaderboardEntry[]>;

  /**
   * Lee `groups.group_streak` (ya calculado por el job `update_group_streaks`,
   * fuera de alcance de este servicio). Devuelve el contador actual.
   */
  getGroupStreak(groupId: string): Promise<number>;
}

/** Resumen del leaderboard semanal de un grupo (SPEC-07 §5, §6). */
export interface WeeklyLeaderboardSummary {
  /** Lunes (00:00:00.000 UTC) de la semana ISO actual, formato 'YYYY-MM-DD'. */
  readonly weekStart: string;

  /**
   * Días que faltan hasta el próximo reinicio del leaderboard (el próximo lunes
   * 00:00:00.000 UTC, a partir de `weekStart`).
   *
   * Fórmula: nextMonday = mondayUtcOf(now) + 7 días;
   * daysRemaining = ceil((nextMonday - now.getTime()) / milisegundos_por_día).
   *
   * Efecto: si `now` es el lunes 00:00:00.000 UTC exactamente, daysRemaining = 7;
   * si es domingo a cualquier hora, daysRemaining = 1; nunca 0 (el reinicio aún no ocurrió).
   * Ver docs/specs/pendientes/PR-07.md §T4 para más detalles.
   */
  readonly daysRemaining: number;

  /** Filas ordenadas por rango (la RPC ya resuelve empates con sesiones y user_id). */
  readonly entries: readonly WeeklyLeaderboardEntry[];

  /** Streak grupal actual, del campo `groups.group_streak`. */
  readonly groupStreak: number;
}

export class LeaderboardService {
  constructor(private readonly repo: LeaderboardRepository) {}

  /**
   * Resumen del leaderboard semanal del grupo en el momento `now` (por defecto, ahora).
   *
   * - `weekStart`: lunes 00:00:00.000 UTC de la semana ISO de `now`.
   * - `entries`: resultado de la RPC `weekly_leaderboard`, sin reordenamiento (la RPC
   *   resuelve empates por sesiones y user_id, SPEC-07 §5).
   * - `daysRemaining`: días hasta el próximo reinicio.
   * - `groupStreak`: contador actual de `groups.group_streak`.
   */
  async week(groupId: string, now: Date = new Date()): Promise<WeeklyLeaderboardSummary> {
    const weekStart = mondayUtcOf(now);
    const weekStartIso = isoDateString(weekStart);

    // Consultas en paralelo.
    const [entries, groupStreak] = await Promise.all([
      this.repo.weeklyLeaderboard(groupId, weekStartIso),
      this.repo.getGroupStreak(groupId),
    ]);

    // Calcula días restantes hasta el próximo reinicio.
    const nextMonday = weekStart.getTime() + 7 * MS_PER_DAY;
    const daysRemaining = Math.ceil((nextMonday - now.getTime()) / MS_PER_DAY);

    return {
      weekStart: weekStartIso,
      daysRemaining,
      entries,
      groupStreak,
    };
  }
}
