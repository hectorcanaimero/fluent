import { Injectable } from '@nestjs/common';
import { resolveWeekStart } from '../common/iso-week.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { aggregateCorrectionsTrend } from './corrections-trend.js';
import { CORRECTIONS_TREND_LOOKBACK_DAYS, CorrectionsRepository } from './corrections.repository.js';
import { levelFor } from './level.js';
import type { ProgressResultDto } from './progress.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `GET /progress` (SPEC-02 §4.5, SPEC-07 §1).
 *
 * **AVISO para PR-07/T1** (docs/specs/pendientes/PR-02.md): esta clase
 * implementa exactamente lo que el alcance de PR-07/T1 describe como
 * `ProgressService` (niveles de XP, sesiones de la semana, tendencia de
 * correcciones). PR-07/T1 no estaba fusionado cuando este PR (T7) lo
 * necesitó, así que se implementó aquí para no bloquear `GET /progress`.
 * **PR-07/T1 debe adoptar esta clase (y `level.ts`/`corrections-trend.ts`/
 * `corrections.repository.ts`) en vez de crear una segunda copia** — moverla
 * de `apps/api/src/progress/` a donde la sesión de PR-07 prefiera, si hace
 * falta, pero reutilizando el código, no reescribiéndolo. Lo único que no
 * cubre (fuera del alcance de T7): "estado de gracia (disponible/usada)".
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly sessionsQuery: SessionsQueryRepository,
    private readonly correctionsRepository: CorrectionsRepository,
  ) {}

  /**
   * No exige grupo (a diferencia de `GET /leaderboard`/`/challenges`/
   * `/weekly-summary`): el progreso es siempre del propio perfil, y
   * `ensureProfile` ya cubre al usuario que todavía no tiene uno (perfil
   * recién creado con `xp=0`, `streak=0`, sin correcciones).
   */
  async getProgress(userId: string, now: Date = new Date()): Promise<ProgressResultDto> {
    const profile = await this.profilesRepository.ensureProfile(userId);

    // `resolveWeekStart(undefined, now)` siempre devuelve un string (nunca
    // `null`: solo puede fallar el parseo de un `weekParam` explícito).
    const weekStart = resolveWeekStart(undefined, now) as string;
    const weekStartIso = `${weekStart}T00:00:00.000Z`;
    const thirtyDaysAgoIso = new Date(
      now.getTime() - CORRECTIONS_TREND_LOOKBACK_DAYS * DAY_MS,
    ).toISOString();

    const [sessionsThisWeek, correctionsRows] = await Promise.all([
      this.sessionsQuery.countValidSessionsSince(userId, weekStartIso),
      this.correctionsRepository.listRecentForTrend(userId, thirtyDaysAgoIso),
    ]);

    return {
      xp: profile.xp,
      level: levelFor(profile.xp),
      streak: profile.streak,
      longestStreak: profile.longest_streak,
      sessionsThisWeek,
      correctionsTrend: aggregateCorrectionsTrend(correctionsRows, now),
    };
  }
}
