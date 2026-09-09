import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { BOSS_TOPICS } from '../content/index.js';
import type { BossRepository } from '../game/boss.service.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES } from '../db/schema.js';
import { BOSS_TOPIC_ROW_LIMIT } from './sessions.constants.js';

/**
 * Implementación de `BossRepository` (`src/game/boss.service.ts`) contra
 * InsForge, que es lo que dejó pendiente PR-07/T3.
 *
 * Criterio de "tema ya usado" (docs/specs/pendientes/PR-07.md T3 §2): ids de
 * `BOSS_TOPICS` cuyo `title_es` aparece como `sessions.topic` en alguna sesión
 * `kind = 'boss'` del usuario con `status <> 'active'` (o sea, `ended` o
 * `abandoned`). Se compara por `title_es` porque `sessions` no guarda el id del
 * tema: `topic` es la etiqueta legible que se muestra en el leaderboard y en
 * los desafíos (SPEC-07 §7/§9), y es exactamente lo que escribe
 * `SessionsService` al abrir un boss.
 */
@Injectable()
export class InsforgeBossRepository implements BossRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  async getUsedBossTopicIds(userId: string): Promise<ReadonlySet<string>> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('topic')
      .eq('user_id', userId)
      .eq('kind', 'boss')
      .neq('status', 'active')
      .limit(BOSS_TOPIC_ROW_LIMIT);

    const rows = unwrapInsforge<{ topic: string }[]>(result) ?? [];
    const usedTitles = new Set(rows.map((row) => row.topic));

    const usedIds = new Set<string>();
    for (const topic of BOSS_TOPICS) {
      if (usedTitles.has(topic.title_es)) {
        usedIds.add(topic.id);
      }
    }
    return usedIds;
  }
}
