import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES, type WeeklySummary } from '../db/schema.js';

/**
 * Repositorio de solo lectura de `weekly_summaries` (SPEC-01 §2.12) para
 * `GET /weekly-summary`. Lo escribe el job de PR-05 (SPEC-05 §4); este PR
 * (T7) solo lee.
 */
@Injectable()
export class WeeklySummaryRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async findByGroupAndWeek(groupId: string, weekStart: string): Promise<WeeklySummary | null> {
    const result = await this.admin.database
      .from(TABLES.weeklySummaries)
      .select('*')
      .eq('group_id', groupId)
      .eq('week_start', weekStart)
      .maybeSingle();

    return unwrapInsforge<WeeklySummary>(result);
  }
}
