/**
 * Job `retention` (SPEC-05 §7). Cron diario 04:00 UTC.
 *
 * - `llm_calls` con más de 90 días: se borran.
 * - `turns` de sesiones con más de 365 días: se borran (se conservan
 *   `sessions` y `corrections` para estadísticas).
 *
 * Lo que SPEC-05 §7 lista y este job **no** hace:
 * - `news_items` con más de 14 días: ya los borra `rss-ingest` en cada
 *   ejecución diaria (`RssIngestService.run()`, PR-05/T2, ya fusionado).
 *   Repetirlo aquí sería trabajo duplicado sobre la misma tabla. Ver
 *   PEND-24 de docs/specs/pendientes/PR-05.md.
 * - Locks caducados: los gestiona el TTL de Redis. Nota informativa de la
 *   spec, no una tarea de este job.
 *
 * Clase pura (sin decorador de Nest), mismo patrón que `RssIngestService`:
 * se construye con un `useFactory` en `maintenance.module.ts` para poder
 * inyectar un reloj (`now`) de mentira en los tests sin depender de un
 * segundo token de Nest solo para eso.
 */
import { Logger } from '@nestjs/common';

import { MaintenanceRepository } from './maintenance.repository.js';

/** SPEC-05 §7: «`llm_calls` > 90 días». */
const LLM_CALLS_RETENTION_DAYS = 90;
/** SPEC-05 §7: «`turns` de sesiones > 365 días». */
const TURNS_RETENTION_DAYS = 365;

export interface RetentionJobResult {
  readonly llmCallsDeleted: number;
  readonly turnsDeleted: number;
}

export interface RetentionServiceOptions {
  readonly repository: MaintenanceRepository;
  /** Reloj inyectable para que los tests fijen "ahora". Por defecto `() => new Date()`. */
  readonly now?: () => Date;
}

export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly repository: MaintenanceRepository;
  private readonly now: () => Date;

  constructor(options: RetentionServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
  }

  async run(): Promise<RetentionJobResult> {
    const nowMs = this.now().getTime();
    const llmCallsCutoff = this.cutoffIso(nowMs, LLM_CALLS_RETENTION_DAYS);
    const turnsCutoff = this.cutoffIso(nowMs, TURNS_RETENTION_DAYS);

    const llmCallsDeleted = await this.repository.deleteLlmCallsOlderThan(llmCallsCutoff);
    const turnsDeleted =
      await this.repository.deleteTurnsForSessionsStartedBefore(turnsCutoff);

    this.logger.debug(
      `retention: llmCallsDeleted=${llmCallsDeleted} (< ${llmCallsCutoff}), turnsDeleted=${turnsDeleted} (sesiones < ${turnsCutoff})`,
    );

    return { llmCallsDeleted, turnsDeleted };
  }

  private cutoffIso(nowMs: number, retentionDays: number): string {
    return new Date(nowMs - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  }
}
