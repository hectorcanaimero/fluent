import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { resolveWeekStart } from '../common/iso-week.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { I18nService } from '../i18n/i18n.service.js';
import { GroupAccessService } from './group-access.service.js';
import { LeaderboardRepository } from './leaderboard.repository.js';
import type { LeaderboardResultDto } from './social.types.js';

/**
 * `GET /leaderboard?week=` (SPEC-07 §5).
 *
 * **AVISO para PR-07/T4** (docs/specs/pendientes/PR-02.md): esta clase es lo
 * que el alcance de PR-07/T4 describe como `LeaderboardService` (semana ISO,
 * "días restantes" no incluido — no lo pide SPEC-02 §4.5 — y `group_streak`).
 * PR-07/T4 no estaba fusionado cuando T7 lo necesitó; **debe adoptar esta
 * clase** (y `common/iso-week.ts` para `weekStart`) en vez de duplicarla.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    private readonly groupAccess: GroupAccessService,
    private readonly groupsRepository: GroupsRepository,
    private readonly leaderboardRepository: LeaderboardRepository,
    private readonly i18n: I18nService,
  ) {}

  async getLeaderboard(
    userId: string,
    weekParam: string | undefined,
    acceptLanguageHeader?: string,
    now: Date = new Date(),
  ): Promise<LeaderboardResultDto> {
    const { group, locale } = await this.groupAccess.requireOwnGroup(userId, acceptLanguageHeader);

    const weekStart = resolveWeekStart(weekParam, now);
    if (weekStart === null) {
      throw ApiException.of('VALIDATION', this.i18n.translate('VALIDATION', locale), {
        extra: {
          details: [{ field: 'week', reason: 'week debe ser una fecha ISO YYYY-MM-DD válida' }],
        },
      });
    }

    const [entries, members] = await Promise.all([
      this.leaderboardRepository.weeklyLeaderboard(group.id, weekStart),
      this.groupsRepository.listMembers(group.id),
    ]);

    // La RPC no devuelve el streak individual (solo xp/sesiones de la
    // semana); se completa desde `profiles` vía `listMembers`, la misma
    // fuente que `GET /group` (RF-6.5, SPEC-07 §9: streak es visible a los
    // demás miembros).
    const streakByUserId = new Map(members.map((member) => [member.user_id, member.streak]));

    return {
      weekStart,
      // El orden de `entries` ya viene resuelto por la RPC (rank, con el
      // desempate de SPEC-07 §5): se preserva tal cual.
      rows: entries.map((entry) => ({
        userId: entry.user_id,
        displayName: entry.display_name,
        xpWeek: entry.xp,
        sessionsWeek: entry.sessions,
        streak: streakByUserId.get(entry.user_id) ?? 0,
      })),
      groupStreak: group.group_streak,
    };
  }
}
