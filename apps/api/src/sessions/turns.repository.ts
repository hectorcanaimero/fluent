import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import type {
  CorrectionCategory,
  Session,
  TurnRole,
} from '../db/schema.js';
import { TABLES } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { HISTORY_TURNS } from '../llm/config.js';
import type { HistoryTurn } from '../llm/prompts/truncate.js';
import { RPC } from '../db/rpc.js';

/** Turno tal y como se lee para el historial del prompt (SPEC-03 §3). */
export interface TurnHistoryRow extends HistoryTurn {
  readonly idx: number;
}

/** Fila a insertar en `turns` (SPEC-01 §2.7). */
export interface InsertTurnRow {
  readonly sessionId: string;
  readonly idx: number;
  readonly role: TurnRole;
  readonly text: string;
  /** Solo con `role = 'tutor'`; nulos también ahí en la respuesta degradada. */
  readonly model?: string | null;
  readonly tokensIn?: number | null;
  readonly tokensOut?: number | null;
  readonly latencyMs?: number | null;
}

/** Fila a insertar en `corrections` (SPEC-01 §2.8). */
/** Argumentos de `record_turn` (MEJ-25). */
export interface RecordTurnArgs {
  readonly sessionId: string;
  /** `idx` del turno **del tutor** (el del usuario es el anterior). */
  readonly tutorIdx: number;
  readonly text: string;
  readonly model?: string | null;
  readonly tokensIn?: number | null;
  readonly tokensOut?: number | null;
  readonly latencyMs?: number | null;
  /** Valor ya calculado de `sessions.turns_count`. */
  readonly turnsCount: number;
  readonly corrections: readonly InsertCorrectionRow[];
}

export interface InsertCorrectionRow {
  readonly sessionId: string;
  readonly userId: string;
  /** `idx` del turno **del usuario** que se corrige. */
  readonly turnIdx: number;
  readonly original: string;
  readonly corrected: string;
  readonly category: CorrectionCategory;
  readonly note: string | null;
}

/**
 * Acceso a datos de `POST /sessions/:id/turns` (SPEC-04 §4).
 *
 * Separado de `SessionsRepository` (que sirve a la apertura) porque son
 * tablas distintas — `turns` y `corrections` — y porque `TurnsService`
 * necesita las dos a la vez sin arrastrar el resto de la apertura.
 *
 * **Aislamiento entre usuarios:** la clave admin no aplica RLS, así que toda
 * lectura o escritura de una sesión concreta filtra siempre por `id` **y**
 * `user_id` (mismo criterio que `MemoryRepository`, PEND-42 de
 * docs/specs/pendientes/PR-02.md). `turns` y `corrections` no tienen
 * `user_id`/`session.user_id` a mano en cada consulta: la propiedad se
 * garantiza porque el `sessionId` con el que se escribe siempre viene de un
 * `findOwnedSession` previo.
 */
@Injectable()
export class TurnsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Sesión del usuario, con **filtro doble** `id` + `user_id`. `null` cubre a
   * la vez «no existe» y «es de otro usuario»: quien llama responde `403
   * FORBIDDEN` en los dos casos, para no filtrar la existencia de sesiones
   * ajenas (PEND-42 de PR-02).
   */
  async findOwnedSession(userId: string, sessionId: string): Promise<Session | null> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<Session>(result);
  }

  /**
   * Los `limit` turnos más recientes de la sesión, **en orden cronológico**
   * (SPEC-04 §4 paso 3, SPEC-03 §3: `HISTORY_TURNS`).
   *
   * Se piden ordenados por `idx` descendente con `limit` y se invierten aquí:
   * es la única forma de quedarse con la *cola* de la conversación sin leer
   * la sesión entera. El elemento final es, por tanto, el turno de mayor
   * `idx` de la sesión, que es lo que usa `TurnsService` para calcular el
   * `idx` del turno nuevo.
   */
  async listRecentTurns(
    sessionId: string,
    limit: number = HISTORY_TURNS,
  ): Promise<TurnHistoryRow[]> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .select('idx, role, text')
      .eq('session_id', sessionId)
      .order('idx', { ascending: false })
      .limit(limit);

    const rows = unwrapInsforge<TurnHistoryRow[]>(result) ?? [];
    return [...rows].reverse();
  }

  /** Inserta un turno (`role = 'user'` o `'tutor'`). */
  async insertTurn(row: InsertTurnRow): Promise<void> {
    const result = await this.admin.database.from(TABLES.turns).insert({
      session_id: row.sessionId,
      idx: row.idx,
      role: row.role,
      text: row.text,
      model: row.model ?? null,
      tokens_in: row.tokensIn ?? null,
      tokens_out: row.tokensOut ?? null,
      latency_ms: row.latencyMs ?? null,
    });

    unwrapInsforge(result);
  }

  /**
   * Borra un turno concreto de una sesión. Solo se usa para no dejar un turno
   * del usuario sin respuesta cuando algo inesperado revienta entre el INSERT
   * y la llamada al modelo (ver docs/specs/pendientes/PR-04.md), igual que
   * `SessionsRepository.deleteSession` en la apertura.
   */
  async deleteTurn(sessionId: string, idx: number): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .delete()
      .eq('session_id', sessionId)
      .eq('idx', idx);

    unwrapInsforge(result);
  }

  /** Inserta las correcciones de un turno. No hace nada con la lista vacía. */
  /**
   * RPC `record_turn` (MEJ-25): turno del tutor, correcciones y contadores de
   * la sesión en **una** transacción.
   *
   * Antes eran tres escrituras encadenadas en la ruta caliente del turno, con
   * tres idas y vueltas a InsForge y sin atomicidad: si fallaba la segunda,
   * quedaba un turno del tutor sin correcciones y con `turns_count`
   * desfasado, y el historial de la llamada siguiente salía mal.
   */
  async recordTurn(args: RecordTurnArgs): Promise<void> {
    const result = await this.admin.database.rpc(RPC.recordTurn, {
      p_session_id: args.sessionId,
      p_tutor_idx: args.tutorIdx,
      p_text: args.text,
      p_model: args.model ?? null,
      p_tokens_in: args.tokensIn ?? null,
      p_tokens_out: args.tokensOut ?? null,
      p_latency_ms: args.latencyMs ?? null,
      p_turns_count: args.turnsCount,
      p_corrections: args.corrections.map((row) => ({
        turn_idx: row.turnIdx,
        original: row.original,
        corrected: row.corrected,
        category: row.category,
        note: row.note,
      })),
    });

    unwrapInsforge(result);
  }

  async insertCorrections(rows: readonly InsertCorrectionRow[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const result = await this.admin.database.from(TABLES.corrections).insert(
      rows.map((row) => ({
        session_id: row.sessionId,
        user_id: row.userId,
        turn_idx: row.turnIdx,
        original: row.original,
        corrected: row.corrected,
        category: row.category,
        note: row.note,
      })),
    );

    unwrapInsforge(result);
  }

  /**
   * `sessions.turns_count` y `sessions.chat_model_used` tras un turno
   * (SPEC-04 §4 paso 6). Filtro doble `id` + `user_id`.
   *
   * `chatModelUsed` se omite en la respuesta degradada: ningún modelo produjo
   * ese texto, así que se conserva el último que sí respondió.
   */
  async updateAfterTurn(
    userId: string,
    sessionId: string,
    patch: { turnsCount: number; chatModelUsed?: string | null },
  ): Promise<void> {
    const body: Record<string, unknown> = { turns_count: patch.turnsCount };
    if (patch.chatModelUsed !== undefined && patch.chatModelUsed !== null) {
      body.chat_model_used = patch.chatModelUsed;
    }

    const result = await this.admin.database
      .from(TABLES.sessions)
      .update(body)
      .eq('id', sessionId)
      .eq('user_id', userId);

    unwrapInsforge(result);
  }
}
