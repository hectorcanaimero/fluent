/**
 * Job disparador `weekly-summary-dispatch` (SPEC-05 §4, último párrafo:
 * «Se encola un job por grupo el lunes 07:00 UTC»).
 *
 * Corre como job repetible de BullMQ (`WeeklySummaryDispatchRegistrar`,
 * registrado en `weekly-summary.module.ts`) y, cada vez que se ejecuta, lista
 * todos los grupos y encola un `JOB_WEEKLY_SUMMARY` por cada uno con el
 * `weekStart` de la semana que acaba de terminar.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { JOB_WEEKLY_SUMMARY, QUEUE_SOCIAL } from '../jobs.constants.js';
import { computePreviousWeekStart } from './week-range.js';
import { WeeklySummaryRepository } from './weekly-summary.repository.js';

/** Carga de un job `weekly-summary` (SPEC-05 §4: «Entrada: `{ groupId, weekStart }`»). */
export interface WeeklySummaryJobData {
  readonly groupId: string;
  readonly weekStart: string;
}

export interface WeeklySummaryDispatchResult {
  readonly weekStart: string;
  readonly groupsEnqueued: number;
}

@Injectable()
export class WeeklySummaryDispatchService {
  private readonly logger = new Logger(WeeklySummaryDispatchService.name);

  constructor(
    private readonly repository: WeeklySummaryRepository,
    @InjectQueue(QUEUE_SOCIAL) private readonly queue: Queue,
  ) {}

  /**
   * `now` es inyectable en los tests; en producción el processor la llama
   * sin argumento (usa el instante real en que corre el disparador).
   *
   * Alcance: se encola para **todos** los grupos de `groups`, sin filtrar
   * por si tienen miembros `onboarded_at IS NOT NULL` (decisión documentada
   * en pendientes/PR-05.md: más simple, y un grupo sin miembros activos
   * simplemente produce un `weekly_leaderboard` vacío, no un error).
   */
  async run(now: Date = new Date()): Promise<WeeklySummaryDispatchResult> {
    const weekStart = computePreviousWeekStart(now);
    const groupIds = await this.repository.listGroupIds();

    await Promise.all(
      groupIds.map((groupId) =>
        this.queue.add(
          JOB_WEEKLY_SUMMARY,
          { groupId, weekStart } satisfies WeeklySummaryJobData,
          // `jobId` estable: si el disparador se reintenta o corre dos veces
          // el mismo lunes, BullMQ ignora el `add` duplicado en silencio
          // mientras el job siga vivo; la unicidad de datos la termina de
          // garantizar `weekly_summaries` (UNIQUE(group_id, week_start)).
          { jobId: `${groupId}-${weekStart}` },
        ),
      ),
    );

    this.logger.log(
      `weekly-summary-dispatch: ${groupIds.length} grupo(s) encolados para ${weekStart}`,
    );

    return { weekStart, groupsEnqueued: groupIds.length };
  }
}
