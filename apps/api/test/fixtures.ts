import { randomUUID } from 'node:crypto';
import type { InsForgeClient } from '@insforge/sdk';
import {
  createE2eGroup,
  registerE2eUser,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';

/**
 * Script de fixtures de PR-02/T7 (SPEC-07, `GET /progress`,
 * `GET /leaderboard`, `GET /challenges`, `GET /weekly-summary`): siembra un
 * grupo con varios miembros, sesiones cerradas con `xp_earned`, `xp_events`,
 * `corrections` de varias categorías y fechas, y un `weekly_summaries`, para
 * que los e2e de este PR no dependan de haber jugado sesiones reales.
 *
 * **Decisión de ubicación** (docs/specs/pendientes/PR-02.md, el alcance de
 * T7 deja elegir entre `apps/api/test/fixtures.ts` y
 * `apps/api/scripts/fixtures.ts`): se elige `apps/api/test/`, porque:
 * 1. Su único uso previsto es desde los `*.e2e-spec.ts` de este mismo
 *    directorio (`social.e2e-spec.ts`), igual que `insforge-e2e.ts`, que ya
 *    vive ahí y no en `scripts/`.
 * 2. No necesita el `INestApplication` de Nest ni `supertest`: todas las
 *    funciones de aquí siembran filas directamente con el cliente admin
 *    (`createAdminClient`), igual que `createE2eGroup`/`createE2eInvitation`
 *    de `insforge-e2e.ts` — así que, si hiciera falta, **sí puede ejecutarse
 *    suelto** con un pequeño script que llame a `loadInsforgeE2eCredentials`
 *    + `createE2eAdminClient` y luego a estas funciones, sin depender de
 *    `apps/api/scripts/`.
 *
 * Crea el perfil (`profiles`) de cada miembro directamente (no vía
 * `POST /invitations/redeem`): es más simple para sembrar varios miembros de
 * una vez y no necesita levantar la app de Nest. `ensureProfile`
 * (`apps/api/src/profiles/profiles.repository.ts`) hace exactamente el mismo
 * `INSERT` mínimo cuando el flujo pasa por la API.
 */

export interface SeededMember {
  readonly user: E2eTestUser;
  readonly displayName: string;
}

export interface SeedGroupFixtureParams {
  /** Cuántos perfiles crear en el grupo, incluido el "dueño" (`members[0]`). */
  readonly memberCount: number;
  readonly namePrefix?: string;
}

export interface SeedGroupFixtureResult {
  readonly groupId: string;
  readonly groupName: string;
  /** `members[0]` es `groups.owner_id`. */
  readonly members: SeededMember[];
}

/** Crea un grupo con `memberCount` miembros, cada uno con su fila en `profiles` ya asignada al grupo. */
export async function seedGroupWithMembers(
  admin: InsForgeClient,
  credentials: InsforgeE2eCredentials,
  params: SeedGroupFixtureParams,
): Promise<SeedGroupFixtureResult> {
  const namePrefix = params.namePrefix ?? 'Fixture';
  const members: SeededMember[] = [];

  for (let i = 0; i < params.memberCount; i += 1) {
    // `profiles.display_name` exige 2 a 30 caracteres (SPEC-01 §2.1, CHECK
    // de la migración): se recorta aquí para que un `namePrefix` largo (los
    // e2e usan el nombre del escenario, no un id corto) no rompa el seed.
    const displayName = clampDisplayName(`${namePrefix} M${i + 1}`);
    const user = await registerE2eUser(credentials, displayName);
    members.push({ user, displayName });
  }

  const groupName = `${namePrefix} Group ${randomUUID().slice(0, 8)}`;
  const group = await createE2eGroup(admin, groupName, members[0]?.user.id);

  for (const member of members) {
    await seedProfile(admin, member.user.id, {
      displayName: member.displayName,
      groupId: group.id,
    });
  }

  return { groupId: group.id, groupName: group.name, members };
}

export interface SeedProfileOverrides {
  readonly displayName?: string;
  readonly groupId?: string | null;
  readonly level?: 'A2' | 'B1' | 'B2';
  readonly xp?: number;
  readonly streak?: number;
  readonly longestStreak?: number;
  readonly lastSessionDay?: string | null; // ISO date
}

/** Inserta la fila de `profiles` de un usuario ya registrado (mismo `INSERT` mínimo que `ensureProfile`). */
export async function seedProfile(
  admin: InsForgeClient,
  userId: string,
  overrides: SeedProfileOverrides = {},
): Promise<void> {
  const { error } = await admin.database.from('profiles').insert({
    user_id: userId,
    display_name: clampDisplayName(overrides.displayName ?? `Fixture ${userId.slice(0, 8)}`),
    level: overrides.level ?? 'A2',
    group_id: overrides.groupId ?? null,
    xp: overrides.xp ?? 0,
    streak: overrides.streak ?? 0,
    longest_streak: overrides.longestStreak ?? 0,
    last_session_day: overrides.lastSessionDay ?? null,
  });

  if (error) {
    throw new Error(`No se pudo sembrar el perfil de prueba: ${error.message}`, { cause: error });
  }
}

export interface SeedSessionParams {
  readonly userId: string;
  readonly topic: string;
  readonly kind?: 'free_topic' | 'roleplay' | 'news' | 'boss';
  readonly status?: 'active' | 'ended' | 'abandoned';
  readonly xpEarned?: number;
  /** Días desde ahora en los que terminó la sesión (ignorado si `status: 'active'`). */
  readonly endedDaysAgo?: number;
  readonly durationSec?: number;
  readonly turnsCount?: number;
}

/** Inserta una sesión (`sessions`, SPEC-01 §2.6) ya cerrada (por defecto) con el XP indicado. */
export async function seedSession(admin: InsForgeClient, params: SeedSessionParams): Promise<string> {
  const status = params.status ?? 'ended';
  const durationSec = params.durationSec ?? 600;
  const endedAt =
    status === 'active'
      ? null
      : new Date(Date.now() - (params.endedDaysAgo ?? 1) * DAY_MS).toISOString();
  const startedAt =
    endedAt !== null
      ? new Date(new Date(endedAt).getTime() - durationSec * 1000).toISOString()
      : new Date().toISOString();

  const { data, error } = await admin.database
    .from('sessions')
    .insert({
      user_id: params.userId,
      kind: params.kind ?? 'free_topic',
      topic: params.topic,
      status,
      started_at: startedAt,
      ended_at: endedAt,
      duration_sec: status === 'active' ? null : durationSec,
      turns_count: params.turnsCount ?? 4,
      xp_earned: params.xpEarned ?? 60,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo sembrar la sesión de prueba: ${error?.message}`, { cause: error });
  }

  return (data as { id: string }).id;
}

export interface SeedXpEventParams {
  readonly userId: string;
  readonly sessionId?: string | null;
  readonly kind: 'session' | 'duration_bonus' | 'double_day' | 'boss' | 'challenge' | 'streak_7';
  readonly amount: number;
}

/** Inserta un evento de XP (`xp_events`, SPEC-01 §2.13), la fuente que agrega `weekly_leaderboard`. */
export async function seedXpEvent(admin: InsForgeClient, params: SeedXpEventParams): Promise<void> {
  const { error } = await admin.database.from('xp_events').insert({
    user_id: params.userId,
    session_id: params.sessionId ?? null,
    kind: params.kind,
    amount: params.amount,
  });

  if (error) {
    throw new Error(`No se pudo sembrar el xp_event de prueba: ${error.message}`, { cause: error });
  }
}

export interface SeedCorrectionParams {
  readonly sessionId: string;
  readonly userId: string;
  readonly category: string;
  /** Días desde ahora en los que se creó la corrección (para el corte de 30/7 días de `correctionsTrend`). */
  readonly daysAgo?: number;
  readonly turnIdx?: number;
}

/** Inserta una corrección (`corrections`, SPEC-01 §2.8) con `created_at` desplazado a `daysAgo`. */
export async function seedCorrection(admin: InsForgeClient, params: SeedCorrectionParams): Promise<void> {
  const createdAt = new Date(Date.now() - (params.daysAgo ?? 1) * DAY_MS).toISOString();

  const { error } = await admin.database.from('corrections').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    turn_idx: params.turnIdx ?? 1,
    original: 'I go to school yesterday.',
    corrected: 'I went to school yesterday.',
    category: params.category,
    created_at: createdAt,
  });

  if (error) {
    throw new Error(`No se pudo sembrar la corrección de prueba: ${error.message}`, { cause: error });
  }
}

/**
 * Inserta un `weekly_summaries` (SPEC-01 §2.12). `weekStart` debe ser un
 * lunes (`EXTRACT(ISODOW FROM week_start) = 1`, CHECK de la migración) —
 * usar `resolveWeekStart` de `src/common/iso-week.ts` (o `isoDateString` de
 * `src/game/iso-week.ts`) para
 * calcularlo, nunca una fecha arbitraria.
 */
export async function seedWeeklySummary(
  admin: InsForgeClient,
  params: { groupId: string; weekStart: string; text: string; stats?: Record<string, unknown> },
): Promise<void> {
  const { error } = await admin.database.from('weekly_summaries').insert({
    group_id: params.groupId,
    week_start: params.weekStart,
    text: params.text,
    stats: params.stats ?? {},
  });

  if (error) {
    throw new Error(
      `No se pudo sembrar el weekly_summary de prueba: ${error.message}`,
      { cause: error },
    );
  }
}

/** Borra todo lo que las funciones de arriba pudieron sembrar para un conjunto de sesiones/grupos. */
export async function cleanupFixtureData(
  admin: InsForgeClient,
  params: { sessionIds?: string[]; groupIds?: string[] },
): Promise<void> {
  for (const sessionId of params.sessionIds ?? []) {
    await admin.database.from('corrections').delete().eq('session_id', sessionId);
    await admin.database.from('xp_events').delete().eq('session_id', sessionId);
    await admin.database.from('sessions').delete().eq('id', sessionId);
  }
  for (const groupId of params.groupIds ?? []) {
    await admin.database.from('weekly_summaries').delete().eq('group_id', groupId);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DISPLAY_NAME_LENGTH = 30; // profiles_display_name_check (SPEC-01 §2.1)

/** Recorta a 30 caracteres, igual que `clampDisplayName` de `ensureProfile` (sin el resto de su lógica). */
function clampDisplayName(raw: string): string {
  return raw.length > MAX_DISPLAY_NAME_LENGTH ? raw.slice(0, MAX_DISPLAY_NAME_LENGTH) : raw;
}
