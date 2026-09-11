import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';
import { TABLES, type Level, type Locale, type Profile } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { RPC } from '../db/rpc.js';

/**
 * Nivel inicial de un perfil creado por `ensureProfile` (docs/specs/pendientes/PR-02.md):
 * SPEC-01 §2.1 exige `level NOT NULL` pero no dice qué nivel dar antes de que
 * el usuario elija el suyo en el onboarding. Se elige el más conservador
 * (`A2`, el nivel más bajo del catálogo) para no sobrestimar a nadie mientras
 * la app todavía no le preguntó.
 */
export const DEFAULT_PROFILE_LEVEL: Level = 'A2';

/** Longitud mínima de `display_name` que exige el CHECK de SPEC-01 §2.1. */
const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 30;
const FALLBACK_DISPLAY_NAME = 'Usuario';

export interface ModelPreferenceRow {
  chatProvider: string;
  chatModel: string;
  briefProvider: string;
  briefModel: string;
}

export interface ProfilePatch {
  display_name?: string;
  level?: Level;
  interests?: string[];
  timezone?: string;
  locale?: Locale;
  onboarded_at?: string | null;
}

/**
 * Recorta y valida el nombre a mostrar: 2 a 30 caracteres (CHECK de SPEC-01
 * §2.1). Si tras recortar espacios no llega a 2 caracteres, se usa un
 * nombre de reserva en vez de fallar la creación perezosa del perfil.
 */
export function clampDisplayName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) {
    return FALLBACK_DISPLAY_NAME;
  }
  return trimmed.length > MAX_DISPLAY_NAME_LENGTH
    ? trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH)
    : trimmed;
}

/** Parte local de un email (`ana.gomez` de `ana.gomez@example.com`). */
export function localPartOfEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const [local] = email.split('@');
  return local && local.length > 0 ? local : null;
}

/**
 * Repositorio de `profiles` (SPEC-01 §2.1) sobre el cliente admin de
 * InsForge. Incluye también un par de lecturas de solo proyección sobre
 * `model_preferences` y `sessions` que necesita `GET /me` (SPEC-02 §4.1):
 * esas dos tablas todavía no tienen su propio repositorio (llegan en
 * PR-02/T5 y T7), así que se leen aquí de forma mínima en vez de bloquear T2
 * en tareas que no le tocan. Ver docs/specs/pendientes/PR-02.md PEND-15.
 *
 * La lectura equivalente de `provider_credentials` sí migró ya a
 * `CredentialsRepository.listStatuses` (PR-02/T4), que es quien manda sobre
 * esa tabla.
 */
@Injectable()
export class ProfilesRepository {
  constructor(
    @Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient,
    private readonly insforgeHttp: InsforgeHttp,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<Profile>(result);
  }

  /**
   * Crea la fila de `profiles` si todavía no existe (idempotente).
   *
   * `redeem_invitation` exige que el perfil ya exista (`PROFILE_NOT_FOUND`,
   * SPEC-01 §5) y no hay ningún trigger que lo cree al registrarse en
   * InsForge, pero SPEC-06 §6 llama `POST /invitations/redeem` justo después
   * del registro. Por eso `GET /me`, `PUT /me/profile` y
   * `POST /invitations/redeem` llaman aquí primero (ver docs/specs/pendientes/PR-02.md).
   */
  async ensureProfile(userId: string): Promise<Profile> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const displayName = await this.deriveDisplayName(userId);

    const insertResult = await this.admin.database
      .from(TABLES.profiles)
      .insert({
        user_id: userId,
        display_name: displayName,
        level: DEFAULT_PROFILE_LEVEL,
        interests: [],
      })
      .select('*')
      .maybeSingle();

    if (insertResult.error) {
      // Carrera: otra petición concurrente (p. ej. GET /me y
      // POST /invitations/redeem casi a la vez) ya creó el perfil.
      // `findByUserId` distingue esto de un fallo real.
      const raceProfile = await this.findByUserId(userId);
      if (raceProfile) {
        return raceProfile;
      }
    }

    const created = unwrapInsforge<Profile>(insertResult);
    if (created === null) {
      throw new Error('ensureProfile: la inserción no devolvió ninguna fila');
    }
    return created;
  }

  async update(userId: string, patch: ProfilePatch): Promise<Profile> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .update(patch)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    const updated = unwrapInsforge<Profile>(result);
    if (updated === null) {
      throw new Error(`update: no existe profiles.user_id=${userId}`);
    }
    return updated;
  }

  /** Preferencia de modelo (`GET /me`); `null` si el usuario no la tiene todavía. */
  async getModelPreference(userId: string): Promise<ModelPreferenceRow | null> {
    const result = await this.admin.database
      .from(TABLES.modelPreferences)
      .select('chat_provider, chat_model, brief_provider, brief_model')
      .eq('user_id', userId)
      .maybeSingle();

    const row = unwrapInsforge<{
      chat_provider: string;
      chat_model: string;
      brief_provider: string;
      brief_model: string;
    }>(result);

    if (row === null) {
      return null;
    }

    return {
      chatProvider: row.chat_provider,
      chatModel: row.chat_model,
      briefProvider: row.brief_provider,
      briefModel: row.brief_model,
    };
  }

  /** Id de la sesión `active` del usuario, o `null` (`GET /me`, SPEC-06 §3). */
  /**
   * RPC `award_profile_completed` (MEJ-14): suma el XP y registra el evento
   * en una sola transacción, una única vez por usuario. Devuelve cuánto
   * concedió, o 0 si ya estaba concedido.
   *
   * La idempotencia vive en la base (índice único parcial sobre
   * `xp_events`), no en un SELECT previo desde aquí: dos peticiones
   * simultáneas al terminar el onboarding no pueden cobrarlo dos veces.
   */
  async awardProfileCompleted(userId: string, amount: number): Promise<number> {
    const result = await this.admin.database.rpc(RPC.awardProfileCompleted, {
      p_user_id: userId,
      p_amount: amount,
    });

    const awarded = unwrapInsforge<number>(result);
    return typeof awarded === 'number' ? awarded : 0;
  }

  async getActiveSessionId(userId: string): Promise<string | null> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = unwrapInsforge<{ id: string }>(result);
    return row?.id ?? null;
  }

  /**
   * Borra los datos de aplicación del usuario (`DELETE /me`, SPEC-02 §4.1).
   *
   * InsForge Cloud no expone `DELETE /api/auth/users/:id` (404), así que la
   * cuenta de auth sobrevive; ver docs/specs/pendientes/PR-02.md. Se borra
   * en cambio todo lo que cuelga de `auth.users` y no de `profiles` (que
   * arrastraría en cascada lo que sí cuelga de ella): `corrections` y
   * `sessions` primero (esta última arrastra `turns` y, si quedara alguna,
   * `corrections` sueltas, por `ON DELETE CASCADE`), y el resto de tablas
   * con `user_id` propio. `profiles` se borra al final.
   */
  async purgeAppData(userId: string): Promise<void> {
    const tablesWithUserId = [
      TABLES.corrections,
      TABLES.sessions,
      TABLES.facts,
      TABLES.coachingBriefHistory,
      TABLES.coachingBriefs,
      TABLES.providerCredentials,
      TABLES.modelPreferences,
      TABLES.xpEvents,
    ];

    for (const table of tablesWithUserId) {
      await this.deleteWhereUserId(table, userId);
    }

    await this.deleteWhereUserId(TABLES.profiles, userId);
  }

  private async deleteWhereUserId(table: string, userId: string): Promise<void> {
    const result = await this.admin.database.from(table).delete().eq('user_id', userId);
    if (result.error) {
      throw new Error(
        `purgeAppData: no se pudieron borrar las filas de '${table}': ${result.error.message}`,
        { cause: result.error },
      );
    }
  }

  /**
   * Nombre a mostrar inicial (`ensureProfile`): el nombre del usuario en
   * InsForge, si no la parte local de su email, si no un nombre de reserva.
   */
  private async deriveDisplayName(userId: string): Promise<string> {
    const user = await this.insforgeHttp.getAuthUser(userId);
    const candidate = user?.name?.trim() || localPartOfEmail(user?.email);
    return clampDisplayName(candidate);
  }
}
