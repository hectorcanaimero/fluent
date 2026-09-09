import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { TABLES, type NewsItem } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { SUGGESTIONS_NEWS_ROW_LIMIT, SUGGESTIONS_ROLEPLAYS_RECENT_EXCLUDE } from './sessions.constants.js';

/**
 * Acceso a datos de `GET /sessions/suggestions` (SPEC-04 §7) que no cubre ya
 * `SessionsRepository` (`findProfile`, reutilizado desde `SuggestionsService`)
 * ni `BossService` (`bossPending`).
 */
@Injectable()
export class SuggestionsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * `topic` de las últimas `limit` sesiones `kind='roleplay'` del usuario,
   * en cualquier estado (SPEC-04 §7: «evitando los 5 últimos usados»; el
   * `topic` guardado es el `title_es` del escenario, ver `scenario.ts`).
   */
  async listRecentRoleplayTopics(
    userId: string,
    limit: number = SUGGESTIONS_ROLEPLAYS_RECENT_EXCLUDE,
  ): Promise<string[]> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('topic')
      .eq('user_id', userId)
      .eq('kind', 'roleplay')
      .order('started_at', { ascending: false })
      .limit(limit);

    const rows = unwrapInsforge<{ topic: string }[]>(result) ?? [];
    return rows.map((row) => row.topic);
  }

  /**
   * Noticias de `news_items.day >= sinceDay`, más recientes primero
   * (SPEC-04 §7: «últimos 3 días»). El filtro por intereses y el recorte a 4
   * los aplica `pickSuggestedNews` (`suggestions.selectors.ts`); esta
   * consulta solo acota la ventana temporal.
   */
  async listRecentNews(
    sinceDay: string,
    limit: number = SUGGESTIONS_NEWS_ROW_LIMIT,
  ): Promise<NewsItem[]> {
    const result = await this.admin.database
      .from(TABLES.newsItems)
      .select('*')
      .gte('day', sinceDay)
      .order('day', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);

    return unwrapInsforge<NewsItem[]>(result) ?? [];
  }
}
