/**
 * Elemento de `sessionsPerDay[]` en `GET /admin/metrics`.
 * Contabiliza todas las sesiones (validas e inválidas) iniciadas en ese día.
 */
export interface SessionsPerDayItem {
  readonly day: string; // ISO 8601 date (YYYY-MM-DD)
  readonly count: number;
}

/**
 * Respuesta de `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2).
 * Solo accesible para el owner del sistema.
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
}
