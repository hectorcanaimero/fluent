import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { resolveWeekStart, weekStartToDate } from '../common/iso-week.js';
import {
  LeaderboardService as GameLeaderboardService,
  type LeaderboardRepository as GameLeaderboardRepository,
} from '../game/leaderboard.service.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { I18nService } from '../i18n/i18n.service.js';
import { GroupAccessService } from './group-access.service.js';
import { LeaderboardRepository } from './leaderboard.repository.js';
import type { LeaderboardResultDto } from './social.types.js';

/**
 * `GET /leaderboard?week=` (SPEC-07 §5).
 *
 * Adaptador delgado sobre `LeaderboardService` de
 * `src/game/leaderboard.service.ts` (PR-07/T4), que resuelve la semana ISO,
 * llama a la RPC `weekly_leaderboard` y compone el `groupStreak`. Este PR
 * aporta lo que su comentario encargaba a «PR-02/T7»: el acceso al grupo, la
 * validación de `?week=`, el `LeaderboardRepository` contra InsForge y el DTO
 * con los nombres que espera la app.
 *
 * Antes de fusionar PR-07 esta clase repetía ese cálculo (PEND-53). Ver
 * docs/specs/pendientes/PR-02.md PEND-71.
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

    // `LeaderboardService.week` calcula el lunes de la semana del instante que
    // recibe. Se le pasa el `weekStart` ya resuelto (que siempre es un lunes),
    // no `now`, para que `?week=` pueda pedir una semana pasada: el lunes de
    // la semana de un lunes es él mismo. `daysRemaining` de esa respuesta se
    // ignora (SPEC-02 §4.5 no lo incluye y para una semana pasada no
    // significaría nada).
    const summary = await new GameLeaderboardService(
      this.repositoryFor(group.group_streak),
    ).week(group.id, weekStartToDate(weekStart));

    const members = await this.groupsRepository.listMembers(group.id);

    // La RPC no devuelve el streak individual (solo xp/sesiones de la
    // semana); se completa desde `profiles` vía `listMembers`, la misma
    // fuente que `GET /group` (RF-6.5, SPEC-07 §9: streak es visible a los
    // demás miembros).
    const streakByUserId = new Map(members.map((member) => [member.user_id, member.streak]));
    const avatarByUserId = new Map(members.map((member) => [member.user_id, member.avatar_url]));

    return {
      weekStart: summary.weekStart,
      // El orden de `entries` ya viene resuelto por la RPC (rank, con el
      // desempate de SPEC-07 §5): se preserva tal cual.
      rows: summary.entries.map((entry) => ({
        userId: entry.user_id,
        displayName: entry.display_name,
        xpWeek: entry.xp,
        sessionsWeek: entry.sessions,
        streak: streakByUserId.get(entry.user_id) ?? 0,
        avatarUrl: avatarByUserId.get(entry.user_id) ?? null,
      })),
      groupStreak: summary.groupStreak,
    };
  }

  /**
   * `LeaderboardRepository` de `src/game/` construido por llamada:
   * `getGroupStreak` devuelve el `groups.group_streak` que
   * `GroupAccessService` ya leyó al comprobar el grupo, en vez de volver a
   * consultar la tabla.
   */
  private repositoryFor(groupStreak: number): GameLeaderboardRepository {
    return {
      weeklyLeaderboard: (groupId, weekStart) =>
        this.leaderboardRepository.weeklyLeaderboard(groupId, weekStart),
      getGroupStreak: async () => groupStreak,
    };
  }
}
