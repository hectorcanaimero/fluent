import type { QueueMetrics } from './queue-metrics.service.js';

/**
 * Elemento de `sessionsPerDay[]` en `GET /admin/metrics`.
 * Contabiliza todas las sesiones (validas e inválidas) iniciadas en ese día.
 */
export interface SessionsPerDayItem {
  readonly day: string; // ISO 8601 date (YYYY-MM-DD)
  readonly count: number;
}

/**
 * Respuesta de `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2, SPEC-05 §9).
 * Solo accesible para el owner del sistema.
 *
 * RF-8.2 pide las cuatro cosas en un mismo sitio: «sesiones por día (14 d),
 * duración media, tasa de fallo LLM, jobs pendientes». Las tres primeras
 * salen de `sessions`/`llm_calls` (PR-02/T8) y la última de los contadores
 * de las colas de BullMQ (PR-05); al fusionar las dos ramas se unieron en
 * este único DTO en vez de dejar dos controladores peleándose por la misma
 * ruta (docs/specs/pendientes/PR-02.md PEND-73, PEND-63).
 */
export interface AdminMetricsDto {
  /**
   * Últimas 14 días, incluyendo días con count=0.
   * Ordena desde el día más antiguo (hace 14 días) al más reciente.
   */
  sessionsPerDay: SessionsPerDayItem[];

  /**
   * Media de `duration_sec` de las sesiones `ended` en los últimos 14 días.
   * `null` si no hay sesiones ended en ese período.
   */
  avgDurationSec: number | null;

  /**
   * Proporción (0 a 1) de llamadas a LLM con `status` distinto de 'ok'.
   * Acompañado por los totales (`total`, `failed`) para contexto.
   */
  llmFailureRate: number;
  llmFailureRateTotals: {
    total: number;
    failed: number;
  };

  /**
   * Contadores (`waiting`, `active`, `failed`) de las 4 colas de BullMQ
   * (SPEC-05 §9): los «jobs pendientes» de RF-8.2.
   */
  queues: QueueMetrics[];
}
