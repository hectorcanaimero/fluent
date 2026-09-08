import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES } from '../db/schema.js';
import type { SessionRow, SessionDurationRow, LlmCallRow } from './metrics-aggregation.js';

/**
 * Repositorio de lectura para las métricas de operador (SPEC-02 §4.6, RF-8.2).
 * Trae datos agregables de `sessions` y `llm_calls` de los últimos 14 días.
 */
@Injectable()
export class AdminRepository {
  private readonly LOOKBACK_DAYS = 14;
  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Sesiones iniciadas en los últimos 14 días (sin filtrar por usuario).
   * Solo devuelve `started_at` para agrupar por día.
   */
  async listRecentSessions(now: Date = new Date()): Promise<SessionRow[]> {
    const sinceIso = new Date(now.getTime() - this.LOOKBACK_DAYS * this.DAY_MS).toISOString();

    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('started_at')
      .gte('started_at', sinceIso)
      .limit(10000); // Red de seguridad generosa

    return unwrapInsforge<SessionRow[]>(result) ?? [];
  }

  /**
   * Sesiones `ended` (finalizadas) en los últimos 14 días, con su `duration_sec`.
   */
  async listRecentEndedSessions(now: Date = new Date()): Promise<SessionDurationRow[]> {
    const sinceIso = new Date(now.getTime() - this.LOOKBACK_DAYS * this.DAY_MS).toISOString();

    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('duration_sec')
      .eq('status', 'ended')
      .gte('ended_at', sinceIso)
      .limit(10000);

    return unwrapInsforge<SessionDurationRow[]>(result) ?? [];
  }

  /**
   * Llamadas a LLM en los últimos 14 días, solo con su `status`.
   */
  async listRecentLlmCalls(now: Date = new Date()): Promise<LlmCallRow[]> {
    const sinceIso = new Date(now.getTime() - this.LOOKBACK_DAYS * this.DAY_MS).toISOString();

    const result = await this.admin.database
      .from(TABLES.llmCalls)
      .select('status')
      .gte('created_at', sinceIso)
      .limit(50000);

    return unwrapInsforge<LlmCallRow[]>(result) ?? [];
  }
}
