import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { TABLES, type Correction, type Session } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { SESSION_DETAIL_CORRECTIONS_LIMIT, SESSION_DETAIL_TURNS_LIMIT } from './sessions.constants.js';
import type { TurnHistoryRow } from './turns.repository.js';

/** Acceso a datos de `GET /sessions` y `GET /sessions/:id` (SPEC-02 §4.3). */
@Injectable()
export class SessionsHistoryRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Página de sesiones del usuario ordenadas por `started_at` descendente
   * (formato del cursor: `sessions-cursor.ts`). Pide `limit + 1` filas para
   * que el servicio sepa si hay página siguiente sin una segunda consulta.
   */
  async listByUser(
    userId: string,
    limit: number,
    cursorStartedAt: string | null,
  ): Promise<Session[]> {
    let query = this.admin.database
      .from(TABLES.sessions)
      .select('*')
      .eq('user_id', userId);

    if (cursorStartedAt !== null) {
      query = query.lt('started_at', cursorStartedAt);
    }

    const result = await query.order('started_at', { ascending: false }).limit(limit + 1);
    return unwrapInsforge<Session[]>(result) ?? [];
  }

  /** Turnos de la sesión, en orden cronológico (SPEC-01 §2.7). */
  async listTurns(
    sessionId: string,
    limit: number = SESSION_DETAIL_TURNS_LIMIT,
  ): Promise<TurnHistoryRow[]> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .select('idx, role, text')
      .eq('session_id', sessionId)
      .order('idx', { ascending: true })
      .limit(limit);

    return unwrapInsforge<TurnHistoryRow[]>(result) ?? [];
  }

  /** Correcciones de la sesión, en el orden en que se generaron. */
  async listCorrections(
    sessionId: string,
    limit: number = SESSION_DETAIL_CORRECTIONS_LIMIT,
  ): Promise<Correction[]> {
    const result = await this.admin.database
      .from(TABLES.corrections)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    return unwrapInsforge<Correction[]>(result) ?? [];
  }
}
