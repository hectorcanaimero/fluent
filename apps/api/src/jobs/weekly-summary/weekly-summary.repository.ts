/**
 * Acceso a datos del job `weekly-summary` (SPEC-05 §4).
 *
 * Deliberadamente estrecho, igual que `coaching-brief.repository.ts`: solo
 * las lecturas y escrituras que necesita este job. La clase abstracta hace
 * de contrato y de token de inyección para poder sustituir la implementación
 * de InsForge por un doble en los tests sin tocar el servicio.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { TABLES } from '../../db/schema.js';
import type { Profile, Provider } from '../../db/schema.js';

export type WeeklyOwnerRow = Pick<Profile, 'locale' | 'plan' | 'plan_expires_at'>;
import {
  RPC,
  type WeeklyLeaderboardArgs,
  type WeeklyLeaderboardEntry,
} from '../../db/rpc.js';
import { weekRangeUtc } from './week-range.js';

/* ============================================================================
   Formas mínimas que el job necesita de cada tabla
   ========================================================================== */

export interface WeeklyGroupRow {
  readonly id: string;
  readonly owner_id: string | null;
  readonly group_streak: number;
}

export interface WeeklyModelPreferenceRow {
  readonly brief_provider: Provider;
  readonly brief_model: string;
}

export interface InsertWeeklySummaryRow {
  readonly group_id: string;
  readonly week_start: string;
  readonly text: string;
  readonly stats: Record<string, unknown>;
}

/* ============================================================================
   Contrato
   ========================================================================== */

@Injectable()
export abstract class WeeklySummaryRepository {
  /** Todos los ids de `groups`. Ver decisión de alcance en PR-05.md. */
  abstract listGroupIds(): Promise<string[]>;
  abstract loadGroup(groupId: string): Promise<WeeklyGroupRow | null>;
  /** `true` si ya existe fila en `weekly_summaries` para `(group_id, week_start)`. */
  abstract summaryExists(groupId: string, weekStart: string): Promise<boolean>;
  abstract loadLeaderboard(
    groupId: string,
    weekStart: string,
  ): Promise<WeeklyLeaderboardEntry[]>;
  /** `topic` de las sesiones `ended` del miembro dentro de la semana (sin agregar). */
  abstract loadMemberTopics(userId: string, weekStart: string): Promise<string[]>;
  /**
   * `profiles.streak` del miembro (racha individual, no la del grupo).
   * `weekly_leaderboard` no la devuelve (SPEC-01 §5 solo da xp/sessions/rank),
   * pero el prompt de SPEC-03 §4.3 la pide por miembro (`WeeklyMember.streak`).
   */
  abstract loadMemberStreak(userId: string): Promise<number>;
  abstract loadOwnerModelPreference(
    ownerId: string,
  ): Promise<WeeklyModelPreferenceRow | null>;
  /** Locale (`{summary_language}`, SPEC-03 §4.3) y plan del owner. */
  abstract loadOwnerProfile(ownerId: string): Promise<WeeklyOwnerRow | null>;
  abstract insertWeeklySummary(row: InsertWeeklySummaryRow): Promise<void>;
}

/* ============================================================================
   Implementación contra InsForge (PostgREST) con el cliente admin
   ========================================================================== */

interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string } | null;
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
export class InsforgeWeeklySummaryRepository extends WeeklySummaryRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly client: InsForgeClient,
  ) {
    super();
  }

  private get db() {
    return this.client.database;
  }

  async listGroupIds(): Promise<string[]> {
    const result = await this.db.from(TABLES.groups).select('id');
    const rows =
      unwrap(result as PostgrestLike<{ id: string }[]>, 'listar los grupos') ?? [];
    return rows.map((row) => row.id);
  }

  async loadGroup(groupId: string): Promise<WeeklyGroupRow | null> {
    const result = await this.db
      .from(TABLES.groups)
      .select('id,owner_id,group_streak')
      .eq('id', groupId)
      .maybeSingle();
    return unwrap(result as PostgrestLike<WeeklyGroupRow>, 'leer el grupo');
  }

  async summaryExists(groupId: string, weekStart: string): Promise<boolean> {
    const result = await this.db
      .from(TABLES.weeklySummaries)
      .select('id')
      .eq('group_id', groupId)
      .eq('week_start', weekStart)
      .maybeSingle();
    const row = unwrap(
      result as PostgrestLike<{ id: string }>,
      'comprobar el resumen semanal existente',
    );
    return row !== null;
  }

  async loadLeaderboard(
    groupId: string,
    weekStart: string,
  ): Promise<WeeklyLeaderboardEntry[]> {
    const result = await this.db.rpc(RPC.weeklyLeaderboard, {
      p_group_id: groupId,
      p_week_start: weekStart,
    } satisfies WeeklyLeaderboardArgs as unknown as Record<string, unknown>);
    return (
      unwrap(
        result as PostgrestLike<WeeklyLeaderboardEntry[]>,
        'leer el weekly_leaderboard',
      ) ?? []
    );
  }

  async loadMemberTopics(userId: string, weekStart: string): Promise<string[]> {
    const { startIso, endIso } = weekRangeUtc(weekStart);
    const result = await this.db
      .from(TABLES.sessions)
      .select('topic')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .gte('ended_at', startIso)
      .lt('ended_at', endIso);
    const rows =
      unwrap(
        result as PostgrestLike<{ topic: string }[]>,
        'leer los temas de las sesiones de la semana',
      ) ?? [];
    return rows.map((row) => row.topic);
  }

  async loadMemberStreak(userId: string): Promise<number> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('streak')
      .eq('user_id', userId)
      .maybeSingle();
    const row = unwrap(
      result as PostgrestLike<{ streak: number }>,
      'leer la racha del miembro',
    );
    return row?.streak ?? 0;
  }

  async loadOwnerModelPreference(
    ownerId: string,
  ): Promise<WeeklyModelPreferenceRow | null> {
    const result = await this.db
      .from(TABLES.modelPreferences)
      .select('brief_provider,brief_model')
      .eq('user_id', ownerId)
      .maybeSingle();
    return unwrap(
      result as PostgrestLike<WeeklyModelPreferenceRow>,
      'leer las preferencias de modelo del owner',
    );
  }

  async loadOwnerProfile(ownerId: string): Promise<WeeklyOwnerRow | null> {
    const result = await this.db
      .from(TABLES.profiles)
      .select('locale,plan,plan_expires_at')
      .eq('user_id', ownerId)
      .maybeSingle();
    return unwrap(result as PostgrestLike<WeeklyOwnerRow>, 'leer el perfil del owner');
  }

  async insertWeeklySummary(row: InsertWeeklySummaryRow): Promise<void> {
    const result = await this.db.from(TABLES.weeklySummaries).insert(row);
    unwrap(result as PostgrestLike<unknown>, 'guardar el resumen semanal');
  }
}
