/**
 * Acceso a datos de la cola `maintenance` (SPEC-05 §6 y §7).
 *
 * Deliberadamente estrecho, mismo patrón que `coaching-brief.repository.ts` y
 * `weekly-summary.repository.ts`: clase abstracta como contrato/token de
 * inyección, implementación contra InsForge (PostgREST) con el cliente
 * admin, y tests que sustituyen la implementación por un doble.
 *
 * Un único repositorio para `daily-streaks` y `retention`: ambos son
 * jobs de mantenimiento pequeños (un par de llamadas cada uno) y no
 * justifican dos archivos separados. `model-catalog` no necesita
 * repositorio (usa `ModelCatalogService` + `RedisCacheStore`, ver
 * `redis-cache-store.ts`).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { TABLES } from '../../db/schema.js';
import {
  RPC,
  type ApplyStreakGraceResult,
  type UpdateGroupStreaksResult,
} from '../../db/rpc.js';

/* ============================================================================
   Contrato
   ========================================================================== */

@Injectable()
export abstract class MaintenanceRepository {
  /** RPC `apply_streak_grace()` (SPEC-05 §6 paso 1). */
  abstract applyStreakGrace(): Promise<ApplyStreakGraceResult>;
  /** RPC `update_group_streaks()` (SPEC-05 §6 paso 2). */
  abstract updateGroupStreaks(): Promise<UpdateGroupStreaksResult>;
  /** Borra `llm_calls` con `created_at < cutoffIso` (SPEC-05 §7). Devuelve cuántas filas borró. */
  abstract deleteLlmCallsOlderThan(cutoffIso: string): Promise<number>;
  /**
   * Borra `turns` de sesiones con `started_at < cutoffIso` (SPEC-05 §7: se
   * conservan `sessions` y `corrections`). PostgREST no permite una
   * subconsulta arbitraria en un filtro `delete`, así que se hace en dos
   * pasos: 1) los ids de las sesiones viejas, 2) `turns` cuyo `session_id`
   * esté en esa lista. Devuelve cuántas filas de `turns` borró.
   *
   * Limitación documentada (PEND-24 de docs/specs/pendientes/PR-05.md): no
   * se trocea la lista de ids en lotes. Para el tamaño de este proyecto
   * (grupo cerrado de 5 a 10 amigos) el número de sesiones con más de un año
   * de antigüedad en una sola ejecución diaria es pequeño y un único
   * `.in('session_id', ids)` es suficiente.
   */
  abstract deleteTurnsForSessionsStartedBefore(cutoffIso: string): Promise<number>;
  /** Ciclos de estudio `active` con sus sesiones, para `study-reminder` (F13.1.T2). */
  abstract listActiveStudyCycles(): Promise<ActiveStudyCycleRow[]>;
  /** Zona horaria de cada perfil (`null` si no tiene), para `study-reminder` (F13.1.T2). */
  abstract loadTimezones(userIds: readonly string[]): Promise<Map<string, string | null>>;
}

/** Una sesión del ciclo, lo justo para decidir el recordatorio (F13.1.T2). */
export interface ActiveStudyCycleSessionRow {
  readonly idx: number;
  readonly title: string;
  readonly doneAt: string | null;
}

/** Ciclo `active` con sus sesiones ordenadas por `idx` (F13.1.T2). */
export interface ActiveStudyCycleRow {
  readonly interviewId: string;
  readonly userId: string;
  readonly sessions: readonly ActiveStudyCycleSessionRow[];
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string } | null;
  count?: number | null;
}

function unwrap<T>(result: PostgrestLike<T>, what: string): T | null {
  if (result.error) {
    throw new Error(
      `InsForge falló al ${what}: ${result.error.message ?? 'error desconocido'}`,
    );
  }
  return result.data;
}

@Injectable()
export class InsforgeMaintenanceRepository extends MaintenanceRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async applyStreakGrace(): Promise<ApplyStreakGraceResult> {
    const result = await this.db.rpc(RPC.applyStreakGrace, {});
    const data = unwrap(
      result as PostgrestLike<ApplyStreakGraceResult>,
      'aplicar la gracia de racha',
    );
    if (!data) {
      throw new Error('apply_streak_grace no devolvió resultado');
    }
    return data;
  }

  async updateGroupStreaks(): Promise<UpdateGroupStreaksResult> {
    const result = await this.db.rpc(RPC.updateGroupStreaks, {});
    const data = unwrap(
      result as PostgrestLike<UpdateGroupStreaksResult>,
      'actualizar la racha grupal',
    );
    if (!data) {
      throw new Error('update_group_streaks no devolvió resultado');
    }
    return data;
  }

  async deleteLlmCallsOlderThan(cutoffIso: string): Promise<number> {
    const result = await this.db
      .from(TABLES.llmCalls)
      .delete({ count: 'exact' })
      .lt('created_at', cutoffIso);
    unwrap(result as PostgrestLike<unknown>, 'borrar llamadas al LLM antiguas');
    return (result as PostgrestLike<unknown>).count ?? 0;
  }

  async deleteTurnsForSessionsStartedBefore(cutoffIso: string): Promise<number> {
    const sessionsResult = await this.db
      .from(TABLES.sessions)
      .select('id')
      .lt('started_at', cutoffIso);
    const sessionRows =
      unwrap(
        sessionsResult as PostgrestLike<{ id: string }[]>,
        'leer las sesiones antiguas',
      ) ?? [];
    const sessionIds = sessionRows.map((row) => row.id);
    if (sessionIds.length === 0) return 0;

    const result = await this.db
      .from(TABLES.turns)
      .delete({ count: 'exact' })
      .in('session_id', sessionIds);
    unwrap(result as PostgrestLike<unknown>, 'borrar turnos antiguos');
    return (result as PostgrestLike<unknown>).count ?? 0;
  }

  async listActiveStudyCycles(): Promise<ActiveStudyCycleRow[]> {
    const result = await this.db
      .from(TABLES.studyCycles)
      .select(`interview_id, user_id, ${TABLES.studyCycleSessions}(idx, title, done_at)`)
      .eq('status', 'active');
    const rows =
      unwrap(
        result as PostgrestLike<
          Array<{
            interview_id: string;
            user_id: string;
            study_cycle_sessions: Array<{ idx: number; title: string; done_at: string | null }> | null;
          }>
        >,
        'leer los ciclos de estudio activos',
      ) ?? [];
    return rows.map((row) => ({
      interviewId: row.interview_id,
      userId: row.user_id,
      sessions: (row.study_cycle_sessions ?? [])
        .map((session) => ({ idx: session.idx, title: session.title, doneAt: session.done_at }))
        .sort((a, b) => a.idx - b.idx),
    }));
  }

  async loadTimezones(userIds: readonly string[]): Promise<Map<string, string | null>> {
    if (userIds.length === 0) return new Map();
    const result = await this.db
      .from(TABLES.profiles)
      .select('user_id, timezone')
      .in('user_id', [...userIds]);
    const rows =
      unwrap(
        result as PostgrestLike<Array<{ user_id: string; timezone: string | null }>>,
        'leer las zonas horarias de los perfiles',
      ) ?? [];
    return new Map(rows.map((row) => [row.user_id, row.timezone]));
  }
}
