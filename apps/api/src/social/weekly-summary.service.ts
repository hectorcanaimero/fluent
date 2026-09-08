import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { resolveWeekStart } from '../common/iso-week.js';
import { I18nService } from '../i18n/i18n.service.js';
import { GroupAccessService } from './group-access.service.js';
import type { WeeklySummaryResultDto } from './social.types.js';
import { WeeklySummaryRepository } from './weekly-summary.repository.js';

/**
 * `GET /weekly-summary?week=` (SPEC-02 §4.5, §6; SPEC-07 §8): lee
 * `weekly_summaries`, que escribe el job de PR-05. Si no hay fila para esa
 * semana, `404 NOT_READY` (no `LLM_UNAVAILABLE` ni un 200 vacío): así lo fija
 * SPEC-02 §4.5 y §6, y es lo que espera
 * `apps/mobile/lib/core/api/http_fluent_api.dart::getWeeklySummary`
 * (convierte ese error en `null`).
 */
@Injectable()
export class WeeklySummaryService {
  constructor(
    private readonly groupAccess: GroupAccessService,
    private readonly weeklySummaryRepository: WeeklySummaryRepository,
    private readonly i18n: I18nService,
  ) {}

  async getWeeklySummary(
    userId: string,
    weekParam: string | undefined,
    acceptLanguageHeader?: string,
    now: Date = new Date(),
  ): Promise<WeeklySummaryResultDto> {
    const { group, locale } = await this.groupAccess.requireOwnGroup(userId, acceptLanguageHeader);

    const weekStart = resolveWeekStart(weekParam, now);
    if (weekStart === null) {
      throw ApiException.of('VALIDATION', this.i18n.translate('VALIDATION', locale), {
        extra: {
          details: [{ field: 'week', reason: 'week debe ser una fecha ISO YYYY-MM-DD válida' }],
        },
      });
    }

    const summary = await this.weeklySummaryRepository.findByGroupAndWeek(group.id, weekStart);
    if (summary === null) {
      throw ApiException.of('NOT_READY', this.i18n.translate('NOT_READY', locale));
    }

    return { text: summary.text, weekStart: summary.week_start };
  }
}
