import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES } from '../db/schema.js';

/** SPEC-03 §7: promedios sobre las últimas 10 sesiones del usuario. */
export const RECENT_SESSIONS_LIMIT = 10;

export interface SessionTokenAverages {
  readonly avgTokensIn: number;
  readonly avgTokensOut: number;
}

interface SessionIdRow {
  id: string;
}

export interface LlmCallTokensRow {
  readonly session_id: string | null;
  readonly tokens_in: number | null;
  readonly tokens_out: number | null;
}

/**
 * Agrega filas de `llm_calls` por `session_id` y promedia `tokens_in`/
 * `tokens_out` **por sesión** (no por fila): una sesión tiene varias
 * llamadas (un turno = una fila), así que primero se suma dentro de cada
 * sesión y solo después se promedia entre sesiones. `null` si no hay
 * ninguna fila con `session_id` (nada que promediar).
 *
 * Función pura, separada de la consulta a InsForge, para poder testear la
 * agregación sin red ni base de datos (docs/specs/pendientes/PR-02.md).
 */
export function aggregateTokensBySession(
  rows: readonly LlmCallTokensRow[],
): SessionTokenAverages | null {
  const totalsBySession = new Map<string, { tokensIn: number; tokensOut: number }>();

  for (const row of rows) {
    if (row.session_id === null) continue;
    const totals = totalsBySession.get(row.session_id) ?? { tokensIn: 0, tokensOut: 0 };
    totals.tokensIn += row.tokens_in ?? 0;
    totals.tokensOut += row.tokens_out ?? 0;
    totalsBySession.set(row.session_id, totals);
  }

  // Solo cuentan las sesiones que de verdad tienen alguna llamada
  // registrada (una sesión sin `llm_calls` no aporta nada al promedio).
  const sessionsWithCalls = [...totalsBySession.values()];
  if (sessionsWithCalls.length === 0) {
    return null;
  }

  const totalIn = sessionsWithCalls.reduce((sum, s) => sum + s.tokensIn, 0);
  const totalOut = sessionsWithCalls.reduce((sum, s) => sum + s.tokensOut, 0);

  return {
    avgTokensIn: totalIn / sessionsWithCalls.length,
    avgTokensOut: totalOut / sessionsWithCalls.length,
  };
}

/**
 * Promedios de tokens **por sesión** de `llm_calls` (SPEC-01 §2.14, SPEC-03
 * §7): `estimatePerSession` necesita `avgTokensIn`/`avgTokensOut` del
 * usuario, calculados sobre sus últimas 10 sesiones. Una sesión tiene varias
 * filas en `llm_calls` (un turno = una fila), así que hay que agrupar por
 * `session_id` y promediar por sesión, no por fila.
 *
 * Decisión (docs/specs/pendientes/PR-02.md): PostgREST no hace `GROUP BY` de
 * forma sencilla, así que se agrega en TypeScript. En vez de traer un número
 * fijo de filas recientes y esperar que alcancen para cubrir 10 sesiones
 * completas (podría no ser así en una sesión muy larga, o sobrar en una muy
 * corta), se hacen **dos** consultas acotadas: primero los ids de las
 * últimas 10 sesiones del usuario (tabla `sessions`, barata: un id por
 * fila), y después **todas** las filas de `llm_calls` de esas sesiones
 * exactas (`.in('session_id', ids)`). Así el resultado es siempre exacto —
 * el promedio de las 10 sesiones reales, ni una fila de más ni de menos —
 * sin necesidad de adivinar un límite de filas.
 */
@Injectable()
export class SessionUsageRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * `null` si el usuario no tiene ninguna sesión con llamadas registradas
   * todavía (quien llama debe usar los valores por defecto de SPEC-03 §7).
   */
  async averageTokensForRecentSessions(userId: string): Promise<SessionTokenAverages | null> {
    const sessionIds = await this.recentSessionIds(userId);
    if (sessionIds.length === 0) {
      return null;
    }

    const rows = await this.llmCallsForSessions(sessionIds);
    return aggregateTokensBySession(rows);
  }

  private async recentSessionIds(userId: string): Promise<string[]> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(RECENT_SESSIONS_LIMIT);

    const rows = unwrapInsforge<SessionIdRow[]>(result) ?? [];
    return rows.map((row) => row.id);
  }

  private async llmCallsForSessions(sessionIds: string[]): Promise<LlmCallTokensRow[]> {
    const result = await this.admin.database
      .from(TABLES.llmCalls)
      .select('session_id, tokens_in, tokens_out')
      .in('session_id', sessionIds);

    return unwrapInsforge<LlmCallTokensRow[]>(result) ?? [];
  }
}
