import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { TABLES, type Locale } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';

export type PushPlatform = 'android' | 'ios';

export interface PushRecipient {
  readonly userId: string;
  readonly locale: Locale;
  readonly tokens: readonly string[];
}

@Injectable()
export class PushRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /** Upsert por token: si el teléfono cambió de usuario, el token pasa a este. */
  async upsertToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.pushTokens)
      .upsert(
        [{ token, user_id: userId, platform, updated_at: new Date().toISOString() }],
        { onConflict: 'token' },
      );
    unwrapInsforge(result);
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.pushTokens)
      .delete()
      .eq('token', token)
      .eq('user_id', userId);
    unwrapInsforge(result);
  }

  /** Tokens que FCM rechazó (app desinstalada, token vencido). */
  async deleteTokens(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return;
    const result = await this.admin.database
      .from(TABLES.pushTokens)
      .delete()
      .in('token', [...tokens]);
    unwrapInsforge(result);
  }

  /** Nombre de [userId] y los otros miembros de su grupo (sin grupo: nadie). */
  async findSenderAndPeers(userId: string): Promise<{ name: string; peers: string[] } | null> {
    const me = unwrapInsforge<{ group_id: string | null; display_name: string }>(
      await this.admin.database
        .from(TABLES.profiles)
        .select('group_id, display_name')
        .eq('user_id', userId)
        .maybeSingle(),
    );
    if (!me?.group_id) return null;
    return { name: me.display_name, peers: await this.listGroupMembers(me.group_id, userId) };
  }

  async listGroupMembers(groupId: string, excludeUserId?: string): Promise<string[]> {
    const rows =
      unwrapInsforge<{ user_id: string }[]>(
        await this.admin.database
          .from(TABLES.profiles)
          .select('user_id')
          .eq('group_id', groupId),
      ) ?? [];
    return rows.map((r) => r.user_id).filter((id) => id !== excludeUserId);
  }

  /** Destinatarios con al menos un token, con el idioma de su perfil. */
  async listRecipients(userIds: readonly string[]): Promise<PushRecipient[]> {
    if (userIds.length === 0) return [];
    const [tokens, profiles] = await Promise.all([
      this.admin.database
        .from(TABLES.pushTokens)
        .select('user_id, token')
        .in('user_id', [...userIds]),
      this.admin.database
        .from(TABLES.profiles)
        .select('user_id, locale')
        .in('user_id', [...userIds]),
    ]);
    const tokenRows = unwrapInsforge<{ user_id: string; token: string }[]>(tokens) ?? [];
    const localeRows = unwrapInsforge<{ user_id: string; locale: Locale }[]>(profiles) ?? [];
    const localeOf = new Map(localeRows.map((r) => [r.user_id, r.locale]));

    const byUser = new Map<string, string[]>();
    for (const row of tokenRows) {
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.token]);
    }
    return [...byUser.entries()].map(([userId, userTokens]) => ({
      userId,
      locale: localeOf.get(userId) ?? 'es',
      tokens: userTokens,
    }));
  }
}
