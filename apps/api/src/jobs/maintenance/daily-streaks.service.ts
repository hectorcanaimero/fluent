/**
 * Job `daily-streaks` (SPEC-05 §6, RF-5.2, RF-6.2). Cron diario 03:30 UTC.
 *
 * Llama, en este orden, a `apply_streak_grace()` (racha individual) y
 * `update_group_streaks()` (racha de grupo) — el orden importa porque la
 * regla de grupo del paso 2 mira `profiles.last_session_day`, no el streak
 * individual, así que no depende de que el paso 1 se haya ejecutado antes,
 * pero SPEC-05 §6 las numera en ese orden y ambas RPC ya son idempotentes
 * por diseño (ver el comentario de cabecera de cada función en
 * `apps/api/migrations/20260908191927_noticias-y-social.sql`).
 */
import { Injectable, Logger } from '@nestjs/common';

import { MaintenanceRepository } from './maintenance.repository.js';

export interface DailyStreaksJobResult {
  /** `apply_streak_grace()`: perfiles a los que se les concedió gracia. */
  readonly graced: number;
  /** `apply_streak_grace()`: perfiles cuyo streak se puso a 0. */
  readonly reset: number;
  /** `update_group_streaks()`: grupos cuyo `group_streak` avanzó. */
  readonly groupsAdvanced: number;
  /** `update_group_streaks()`: grupos cuyo `group_streak` se puso a 0. */
  readonly groupsReset: number;
  /** `update_group_streaks()`: grupos ya actualizados hoy (ejecución repetida). */
  readonly groupsSkipped: number;
}

@Injectable()
export class DailyStreaksService {
  private readonly logger = new Logger(DailyStreaksService.name);

  constructor(private readonly repository: MaintenanceRepository) {}

  async run(): Promise<DailyStreaksJobResult> {
    const grace = await this.repository.applyStreakGrace();
    const groups = await this.repository.updateGroupStreaks();

    this.logger.debug(
      `apply_streak_grace: ${JSON.stringify(grace)}, update_group_streaks: ${JSON.stringify(groups)}`,
    );

    return {
      graced: grace.graced,
      reset: grace.reset,
      groupsAdvanced: groups.advanced,
      groupsReset: groups.reset,
      groupsSkipped: groups.skipped,
    };
  }
}
