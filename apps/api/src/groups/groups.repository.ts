import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { TABLES, type Group } from '../db/schema.js';
import { RPC, type RedeemInvitationResult } from '../db/rpc.js';
import {
  POSTGRES_UNIQUE_VIOLATION,
  unwrapInsforge,
} from '../insforge/insforge-result.js';
import { toRpcError } from '../insforge/rpc-error.mapper.js';
import type { ApiErrorCode } from '../common/api-error.js';

/**
 * Alfabeto de invitaciones sin ambigüedad (SPEC-01 §2.3, decisión de
 * `docs/specs/pendientes/PR-01.md` §5): mayúsculas y dígitos, sin `0`, `O`,
 * `1` ni `I`. Coincide exactamente con el CHECK
 * `code ~ '^[A-HJ-NP-Z2-9]{8}$'` de la migración de PR-01.
 */
export const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITATION_CODE_LENGTH = 8;
const INVITATION_EXPIRES_IN_DAYS = 14;
const MAX_CODE_COLLISION_RETRIES = 5;

/** Genera un código de invitación aleatorio con `node:crypto` (sin librerías nuevas). */
export function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < INVITATION_CODE_LENGTH; i += 1) {
    code += INVITATION_CODE_ALPHABET[randomInt(INVITATION_CODE_ALPHABET.length)];
  }
  return code;
}

/** Invitación recién creada (MEJ-41): lo que devuelve `POST /groups/invitations`. */
export interface CreatedInvitation {
  readonly code: string;
  /** ISO 8601; `now + INVITATION_EXPIRES_IN_DAYS`. */
  readonly expiresAt: string;
}

export interface GroupMemberRow {
  user_id: string;
  display_name: string;
  level: 'A2' | 'B1' | 'B2';
  xp: number;
  streak: number;
  last_session_day: string | null;
  /** Foto del login social (https) o null. Visible para el grupo. */
  avatar_url: string | null;
}

/**
 * Repositorio de `groups` e `invitations` (SPEC-01 §2.2, §2.3) sobre el
 * cliente admin de InsForge.
 *
 * La lectura de `members[]` (`GET /group`) usa la tabla `profiles`
 * directamente con el cliente admin, filtrando por `group_id`, en vez de la
 * vista `group_members` de PR-01: esa vista está pensada para el token del
 * propio usuario (RLS + `current_group_id()`, que depende de `auth.uid()`),
 * que con la clave admin es siempre nulo (alcance de T2 en
 * `docs/tasks/PR-02-auth-y-api.md`).
 */
@Injectable()
export class GroupsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async findById(groupId: string): Promise<Group | null> {
    const result = await this.admin.database
      .from(TABLES.groups)
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    return unwrapInsforge<Group>(result);
  }

  /** Miembros del grupo, **solo** las columnas de RF-6.5 / SPEC-07 §9. */
  async listMembers(groupId: string): Promise<GroupMemberRow[]> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .select('user_id, display_name, level, xp, streak, last_session_day, avatar_url')
      .eq('group_id', groupId)
      .order('xp', { ascending: false });

    return unwrapInsforge<GroupMemberRow[]>(result) ?? [];
  }

  /**
   * Canjea una invitación (RPC `redeem_invitation`, SPEC-01 §5). Pasa
   * `p_user_id` explícito porque la llama con la clave admin, donde
   * `auth.uid()` es nulo (pendientes/PR-01 §3).
   */
  async redeemInvitation(
    userId: string,
    code: string,
    messageForCode: (code: ApiErrorCode) => string,
  ): Promise<RedeemInvitationResult> {
    const result = await this.admin.database.rpc(RPC.redeemInvitation, {
      p_code: code,
      p_user_id: userId,
    });

    if (result.error) {
      throw toRpcError(result.error, messageForCode);
    }

    return result.data as unknown as RedeemInvitationResult;
  }

  /**
   * Crea `count` invitaciones para `groupId` (SPEC-02 §4.1, RF-8.1).
   * `expires_at` = ahora + 14 días; reintenta con otro código aleatorio ante
   * colisión de PK (violación de UNIQUE, código `23505`).
   */
  async createInvitations(
    groupId: string,
    createdBy: string,
    count: number,
  ): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      codes.push((await this.insertOneInvitation(groupId, createdBy)).code);
    }
    return codes;
  }

  /** Una sola invitación, con su vencimiento (MEJ-41, `POST /groups/invitations`). */
  createInvitation(groupId: string, createdBy: string): Promise<CreatedInvitation> {
    return this.insertOneInvitation(groupId, createdBy);
  }

  /**
   * Cuántas invitaciones vivas creó `createdBy`: sin canjear (`used_by` nulo)
   * y sin caducar (MEJ-41). Una caducada ya no sirve a nadie, así que no
   * cuenta para el límite. Lee como mucho `limit` filas porque quien llama
   * solo necesita saber si se pasó del tope, no el total exacto.
   */
  async countLiveInvitations(createdBy: string, limit: number, now: Date = new Date()): Promise<number> {
    const result = await this.admin.database
      .from(TABLES.invitations)
      .select('code')
      .eq('created_by', createdBy)
      .is('used_by', null)
      .gt('expires_at', now.toISOString())
      .limit(limit);

    return (unwrapInsforge<{ code: string }[]>(result) ?? []).length;
  }

  private async insertOneInvitation(
    groupId: string,
    createdBy: string,
  ): Promise<CreatedInvitation> {
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    for (let attempt = 0; attempt < MAX_CODE_COLLISION_RETRIES; attempt += 1) {
      const code = generateInvitationCode();
      const result = await this.admin.database.from(TABLES.invitations).insert({
        code,
        group_id: groupId,
        created_by: createdBy,
        expires_at: expiresAt,
      });

      if (!result.error) {
        return { code, expiresAt };
      }

      if (result.error.code !== POSTGRES_UNIQUE_VIOLATION) {
        throw new Error(
          `No se pudo crear la invitación: ${result.error.message}`,
          { cause: result.error },
        );
      }
      // Colisión de PK (código ya existente): se reintenta con otro.
    }

    throw new Error(
      `No se pudo generar un código de invitación único tras ${MAX_CODE_COLLISION_RETRIES} intentos`,
    );
  }
}
