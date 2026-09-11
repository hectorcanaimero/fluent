/**
 * Tipos de funciones RPC · GENERADO A MANO a partir de las migraciones
 *
 * Cada función RPC se invoca por POST /api/database/rpc/<nombre> con la clave admin,
 * excepto `weekly_leaderboard`, que también puede llamarla la app con su token de usuario.
 *
 * Los tipos de argumentos y resultado se extraen directamente del SQL de cada función RPC.
 * Si una función cambia en las migraciones, este fichero debe actualizarse manualmente.
 *
 * Migraciones de origen:
 * - 20260908171114_grupos-invitaciones-perfiles.sql (redeem_invitation)
 * - 20260908190806_sesiones-turnos-correcciones.sql (close_session)
 * - 20260908191227_memoria-hechos-y-brief.sql (pick_callback_fact, apply_brief)
 * - 20260908191927_noticias-y-social.sql (weekly_leaderboard, apply_streak_grace, update_group_streaks)
 */

import type { Fact, Level, RecurringError } from './schema.js';

/** Hecho tal y como lo manda el job de coaching brief a `apply_brief`. */
export interface BriefFactInput {
  text: string;
  /** ISO 8601 date; ausente o null si el hecho no tiene fecha. */
  happens_on?: string | null;
}

/* ============================================================================
   redeem_invitation(p_code, p_user_id)
   Migración 1 · SPEC-01 §5, SPEC-02 §3
   ========================================================================== */

export interface RedeemInvitationArgs {
  p_code: string;
  p_user_id?: string | null; // DEFAULT NULL
}

export interface RedeemInvitationResult {
  group_id: string;
  name: string;
  group_streak: number;
}

/* ============================================================================
   close_session(p_session_id, p_duration_sec, p_turns_count)
   Migración 3 · SPEC-01 §5, SPEC-07 §2
   ========================================================================== */

export interface CloseSessionArgs {
  p_session_id: string;
  p_duration_sec: number;
  p_turns_count: number;
}

export interface CloseSessionResult {
  xp_earned: number;
  streak: number;
  is_double_day: boolean;
  next_is_boss: boolean;
}

/* ============================================================================
   pick_callback_fact(p_user_id)
   Migración 4 · SPEC-01 §5, RF-4.4
   ========================================================================== */

export interface PickCallbackFactArgs {
  p_user_id: string;
}

export type PickCallbackFactResult = Fact | null;

/* ============================================================================
   apply_brief(p_session_id, p_brief, p_level_hint, p_recurring_errors, p_facts)
   Migración 4 · SPEC-05 §2 paso 4
   ========================================================================== */

export interface ApplyBriefArgs {
  p_session_id: string;
  p_brief: string;
  p_level_hint?: Level | null; // DEFAULT NULL
  p_recurring_errors?: RecurringError[]; // DEFAULT '[]'::jsonb; la función se queda con los 5 primeros
  p_facts?: BriefFactInput[]; // DEFAULT '[]'::jsonb
}

export interface ApplyBriefResult {
  applied: boolean;
  facts_inserted: number;
  facts_skipped: number;
}

/* ============================================================================
   weekly_leaderboard(p_group_id, p_week_start)
   Migración 5 · SPEC-01 §5, SPEC-07 §5
   Callable por app (token usuario) y API (clave admin)
   ========================================================================== */

export interface WeeklyLeaderboardArgs {
  p_group_id: string;
  p_week_start: string; // ISO 8601 date
}

export interface WeeklyLeaderboardEntry {
  user_id: string;
  display_name: string;
  xp: number;
  sessions: number;
  rank: number;
}

export type WeeklyLeaderboardResult = WeeklyLeaderboardEntry[];

/* ============================================================================
   apply_streak_grace()
   Migración 5 · SPEC-05 §6 paso 1, SPEC-07 §3
   ========================================================================== */

/** Sin argumentos: el job la llama tal cual. */
export type ApplyStreakGraceArgs = Record<string, never>;

export interface ApplyStreakGraceResult {
  graced: number;
  reset: number;
}

/* ============================================================================
   update_group_streaks()
   Migración 5 · SPEC-05 §6 paso 2, SPEC-07 §6
   ========================================================================== */

/** Sin argumentos: el job la llama tal cual. */
export type UpdateGroupStreaksArgs = Record<string, never>;

export interface UpdateGroupStreaksResult {
  advanced: number;
  reset: number;
  skipped: number;
}

/* ============================================================================
   Mapa tipificado de funciones RPC
   Para usar en un helper genérico que invoque funciones por nombre
   ========================================================================== */

export interface RpcMap {
  redeem_invitation: {
    args: RedeemInvitationArgs;
    result: RedeemInvitationResult;
  };
  close_session: {
    args: CloseSessionArgs;
    result: CloseSessionResult;
  };
  pick_callback_fact: {
    args: PickCallbackFactArgs;
    result: PickCallbackFactResult;
  };
  apply_brief: {
    args: ApplyBriefArgs;
    result: ApplyBriefResult;
  };
  weekly_leaderboard: {
    args: WeeklyLeaderboardArgs;
    result: WeeklyLeaderboardResult;
  };
  apply_streak_grace: {
    args: ApplyStreakGraceArgs;
    result: ApplyStreakGraceResult;
  };
  update_group_streaks: {
    args: UpdateGroupStreaksArgs;
    result: UpdateGroupStreaksResult;
  };
}

/* ============================================================================
   Nombres de funciones RPC en SQL (para queries sin strings sueltos)
   ========================================================================== */

export const RPC = {
  redeemInvitation: 'redeem_invitation',
  closeSession: 'close_session',
  pickCallbackFact: 'pick_callback_fact',
  applyBrief: 'apply_brief',
  weeklyLeaderboard: 'weekly_leaderboard',
  applyStreakGrace: 'apply_streak_grace',
  updateGroupStreaks: 'update_group_streaks',
  /** MEJ-14: 20 XP idempotentes al completar el perfil. */
  awardProfileCompleted: 'award_profile_completed',
  /** MEJ-25: turno del tutor, correcciones y contadores en una transacción. */
  recordTurn: 'record_turn',
} as const;
