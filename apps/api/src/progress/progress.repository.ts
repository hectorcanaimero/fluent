import { Injectable } from '@nestjs/common';
import type {
  ProgressCorrectionRow,
  ProgressProfileRow,
  ProgressRepository,
} from '../game/progress.service.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { CorrectionsRepository } from './corrections.repository.js';

/**
 * `ProgressRepository` de `src/game/progress.service.ts` (PR-07/T1)
 * implementado contra InsForge, que es justo lo que su comentario de cabecera
 * encargaba a «PR-02/T7».
 *
 * No tiene lógica de negocio: traduce `snake_case` a `camelCase` y reparte las
 * tres lecturas entre los repositorios que ya existían
 * (`ProfilesRepository`, `SessionsQueryRepository`, `CorrectionsRepository`).
 * La definición de "sesión válida" (`status = 'ended' AND xp_earned > 0`,
 * contada por `ended_at`) vive en `SessionsQueryRepository`, como pide la
 * interfaz.
 */
@Injectable()
export class InsforgeProgressRepository implements ProgressRepository {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly sessionsQuery: SessionsQueryRepository,
    private readonly correctionsRepository: CorrectionsRepository,
  ) {}

  /**
   * `ensureProfile` en vez de un `find`: un usuario recién registrado que abre
   * la pantalla de Home antes de terminar el onboarding tiene que ver un
   * progreso a cero, no un 404 (mismo criterio que `GET /me`).
   */
  async getProfile(userId: string): Promise<ProgressProfileRow> {
    const profile = await this.profilesRepository.ensureProfile(userId);

    return {
      xp: profile.xp,
      streak: profile.streak,
      longestStreak: profile.longest_streak,
      timezone: profile.timezone,
      graceUsedWeek: profile.grace_used_week,
    };
  }

  async countValidSessionsSince(userId: string, sinceIso: string): Promise<number> {
    return this.sessionsQuery.countValidSessionsSince(userId, sinceIso);
  }

  async getCorrectionsSince(
    userId: string,
    sinceIso: string,
  ): Promise<ProgressCorrectionRow[]> {
    const rows = await this.correctionsRepository.listRecentForTrend(userId, sinceIso);

    return rows.map((row) => ({
      category: row.category,
      createdAt: row.created_at,
    }));
  }
}
