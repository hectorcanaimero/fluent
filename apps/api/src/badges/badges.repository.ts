import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { RPC } from '../db/rpc.js';
import { TABLES } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import type { BadgeProgressSource, BadgeRow, UserBadgeRow } from './badges.types.js';

@Injectable()
export class BadgesRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /** RPC `award_badges` sin sesión: otorga lo que el usuario ya cumple. */
  async awardPending(userId: string): Promise<void> {
    const result = await this.admin.database.rpc(RPC.awardBadges, {
      p_user_id: userId,
      p_session_id: null,
    });
    if (result.error) {
      throw new Error(`award_badges: ${result.error.message}`);
    }
  }

  /** Catálogo activo en el orden en que se muestra. */
  async listCatalog(): Promise<BadgeRow[]> {
    const result = await this.admin.database
      .from(TABLES.badges)
      .select('id, category, threshold, sort_order, image_key')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    return unwrapInsforge<BadgeRow[]>(result) ?? [];
  }

  async listEarned(userId: string): Promise<UserBadgeRow[]> {
    const result = await this.admin.database
      .from(TABLES.userBadges)
      .select('badge_id, earned_at')
      .eq('user_id', userId);
    return unwrapInsforge<UserBadgeRow[]>(result) ?? [];
  }

  async findProgressSource(userId: string): Promise<BadgeProgressSource | null> {
    const result = await this.admin.database
      .from(TABLES.profiles)
      .select('xp, streak, longest_streak, sessions_count')
      .eq('user_id', userId)
      .maybeSingle();
    return unwrapInsforge<BadgeProgressSource>(result);
  }
}
