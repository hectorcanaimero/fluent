import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import type { ApiErrorCode } from '../common/api-error.js';
import { RPC, type CloseSessionArgs, type CloseSessionResult } from '../db/rpc.js';
import { TABLES } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { toRpcError } from '../insforge/rpc-error.mapper.js';
import { SESSION_END_CORRECTIONS_ROW_LIMIT } from './sessions.constants.js';

/** Acceso a datos de `POST /sessions/:id/end` (SPEC-04 §5). */
@Injectable()
export class EndSessionRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * RPC `close_session` (SPEC-01 §5, SPEC-07 §2). Idempotente: sobre una
   * sesión que ya no está `active` devuelve el `xp_earned` que ya tenía
   * (docs/specs/pendientes/PR-01.md §15).
   */
  async closeSession(
    args: CloseSessionArgs,
    messageForCode: (code: ApiErrorCode) => string,
  ): Promise<CloseSessionResult> {
    // Objeto literal fresco (no la variable `args` tal cual): el `rpc()` del
    // SDK pide `Record<string, unknown>` y una interfaz sin índice (como
    // `CloseSessionArgs`) no es asignable ahí salvo como literal — mismo
    // patrón que el resto de llamadas RPC del repo (`pickCallbackFact`,
    // `redeemInvitation`).
    const result = await this.admin.database.rpc(RPC.closeSession, {
      p_session_id: args.p_session_id,
      p_duration_sec: args.p_duration_sec,
      p_turns_count: args.p_turns_count,
    });
    if (result.error) {
      throw toRpcError(result.error, messageForCode);
    }
    return result.data as unknown as CloseSessionResult;
  }

  /**
   * RPC `award_badges`: inserta las insignias que el usuario ya cumple y
   * devuelve los ids de las recién ganadas (idempotente).
   */
  async awardBadges(userId: string, sessionId: string): Promise<string[]> {
    const result = await this.admin.database.rpc(RPC.awardBadges, {
      p_user_id: userId,
      p_session_id: sessionId,
    });
    if (result.error) {
      throw new Error(`award_badges: ${result.error.message}`);
    }
    return (result.data as unknown as string[] | null) ?? [];
  }

  /**
   * Número de `corrections` de la sesión, para `SessionSummary.correctionsCount`
   * (SPEC-04 §5). Se cuenta trayendo `id` hasta `limit` filas y midiendo el
   * array: mismo patrón que `src/sessions-query/sessions-query.repository.ts`,
   * sin depender de `count: 'exact'` de PostgREST.
   */
  async countCorrections(
    sessionId: string,
    limit: number = SESSION_END_CORRECTIONS_ROW_LIMIT,
  ): Promise<number> {
    const result = await this.admin.database
      .from(TABLES.corrections)
      .select('id')
      .eq('session_id', sessionId)
      .limit(limit);

    return (unwrapInsforge<{ id: string }[]>(result) ?? []).length;
  }

  /**
   * `sessions.brief_job_status = 'done'` cuando la sesión no llega a
   * `MIN_TURNS_FOR_BRIEF` (SPEC-04 §5.3): no hace falta job. El camino
   * contrario no toca esta columna, porque nace `'pending'` por defecto
   * (migración 3). Filtro doble `id` + `user_id`.
   */
  async markBriefDone(userId: string, sessionId: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .update({ brief_job_status: 'done' })
      .eq('id', sessionId)
      .eq('user_id', userId);

    unwrapInsforge(result);
  }
}
