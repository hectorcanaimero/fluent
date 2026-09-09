import { Inject, Injectable } from '@nestjs/common';
import { ROLEPLAYS, TOPICS } from '../content/index.js';
import { ApiException } from '../common/api-error.js';
import { BossService } from '../game/boss.service.js';
import { isoDateString } from '../game/iso-week.js';
import { SessionsRepository } from './sessions.repository.js';
import { SuggestionsRepository } from './suggestions.repository.js';
import {
  interestTagSet,
  pickSuggestedNews,
  pickSuggestedRoleplays,
  pickSuggestedTopics,
} from './suggestions.selectors.js';
import { SESSION_RANDOM, SUGGESTIONS_NEWS_MAX_AGE_DAYS, type SessionRandom } from './sessions.constants.js';
import type { NewsSuggestionDto, RoleplaySuggestionDto, SessionSuggestionsDto } from './sessions.types.js';

const NOT_ONBOARDED_MESSAGE = 'Completa tu perfil antes de pedir sugerencias.';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `GET /sessions/suggestions` (SPEC-04 §7). La selección en sí (barajado,
 * intersección de tags, exclusión de recientes) vive en
 * `suggestions.selectors.ts` como funciones puras; este servicio solo carga
 * los datos y las llama.
 */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly repository: SuggestionsRepository,
    private readonly boss: BossService,
    @Inject(SESSION_RANDOM) private readonly random: SessionRandom,
  ) {}

  async getSuggestions(userId: string, now: Date = new Date()): Promise<SessionSuggestionsDto> {
    const profile = await this.sessions.findProfile(userId);
    if (profile === null || profile.onboarded_at === null) {
      throw ApiException.of('NOT_ONBOARDED', NOT_ONBOARDED_MESSAGE);
    }

    const interestTags = interestTagSet(profile.interests);

    const [recentRoleplayTopics, recentNews, bossPending] = await Promise.all([
      this.repository.listRecentRoleplayTopics(userId),
      this.repository.listRecentNews(newsSinceDay(now)),
      this.boss.isPending(
        userId,
        { sessionsCount: profile.sessions_count, level: profile.level },
        now,
      ),
    ]);

    const topics = pickSuggestedTopics(TOPICS, interestTags, profile.level, this.random);

    const roleplays: RoleplaySuggestionDto[] = pickSuggestedRoleplays(
      ROLEPLAYS,
      profile.level,
      new Set(recentRoleplayTopics),
    ).map((roleplay) => ({ id: roleplay.id, title: roleplay.title_es }));

    const news: NewsSuggestionDto[] = pickSuggestedNews(recentNews, interestTags).map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      summary: item.summary ?? undefined,
      time: item.published_at ?? undefined,
    }));

    return { topics, roleplays, news, bossPending };
  }
}

/** `news_items.day` (ISO `YYYY-MM-DD`) de hace `SUGGESTIONS_NEWS_MAX_AGE_DAYS` días. */
function newsSinceDay(now: Date): string {
  return isoDateString(new Date(now.getTime() - SUGGESTIONS_NEWS_MAX_AGE_DAYS * DAY_MS));
}
