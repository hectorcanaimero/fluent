import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { RPC, type WeeklyLeaderboardResult } from '../db/rpc.js';

/**
 * Repositorio de la RPC `weekly_leaderboard` (SPEC-01 §5, SPEC-07 §5) para
 * `GET /leaderboard`.
 *
 * Se llama siempre con la clave admin (`INSFORGE_ADMIN_CLIENT`): `auth.uid()`
 * es nulo en ese caso, así que la guarda contra grupo cruzado de la propia
 * función SQL (`docs/specs/pendientes/PR-01.md` §23) no se aplica aquí — por
 * eso el `groupId` que se le pasa **debe** venir siempre del perfil del
 * usuario autenticado (`GroupAccessService.requireOwnGroup`), nunca de un
 * parámetro que el cliente pueda elegir libremente.
 */
@Injectable()
export class LeaderboardRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async weeklyLeaderboard(groupId: string, weekStart: string): Promise<WeeklyLeaderboardResult> {
    const result = await this.admin.database.rpc(RPC.weeklyLeaderboard, {
      p_group_id: groupId,
      p_week_start: weekStart,
    });

    if (result.error) {
      throw new Error(
        `Error de RPC weekly_leaderboard: ${result.error.message} (code=${result.error.code ?? '?'})`,
        { cause: result.error },
      );
    }

    return (result.data as unknown as WeeklyLeaderboardResult) ?? [];
  }
}
