import type { SessionsPerDayItem } from './admin.types.js';

/**
 * Fila mínima de `sessions` para agregar sesiones por día.
 */
export interface SessionRow {
  readonly started_at: string; // ISO 8601 timestamp
}

/**
 * Fila mínima de `llm_calls` para calcular la tasa de fallo.
 */
export interface LlmCallRow {
  readonly status: string;
}

/**
 * Fila mínima de `sessions` para calcular duración media.
 */
export interface SessionDurationRow {
  readonly duration_sec: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Agrega filas de `sessions` en `sessionsPerDay[]` para los últimos 14 días.
 * Incluye días con count=0 si no hay sesiones ese día.
 *
 * `SessionsRepository` trae las filas ya acotadas a los últimos 14 días
 * (`started_at >= hace 14 días`), y esta función pura las agrega en
 * TypeScript por `started_at` date (ISO 8601, sin hora). Ordena desde el día
 * más antiguo al más reciente.
 */
export function aggregateSessionsPerDay(
  rows: readonly SessionRow[],
  now: Date = new Date(),
): SessionsPerDayItem[] {
  // Inicializa los últimos 14 días con count=0.
  const dayMap = new Map<string, number>();
  const today = dateOnly(now);
  const todayMs = today.getTime();

  for (let i = 13; i >= 0; i--) {
    const dayMs = todayMs - i * DAY_MS;
    const day = dateOnly(new Date(dayMs));
    const dayStr = day.toISOString().split('T')[0];
    dayMap.set(dayStr, 0);
  }

  // Agrega las filas del repositorio.
  for (const row of rows) {
    try {
      const createdAt = new Date(row.started_at);
      if (Number.isNaN(createdAt.getTime())) {
        continue; // Ignora timestamps inválidos
      }
      const day = dateOnly(createdAt).toISOString().split('T')[0];
      const count = dayMap.get(day) ?? 0;
      dayMap.set(day, count + 1);
    } catch {
      // Ignora cualquier error al procesar la fila
      continue;
    }
  }

  // Ordena y devuelve.
  return [...dayMap.entries()]
    .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
    .map(([day, count]) => ({ day, count }));
}

/**
 * Calcula la media de `duration_sec` de las sesiones.
 * Devuelve `null` si no hay sesiones o todas tienen `duration_sec` nulo.
 */
export function calculateAvgDurationSec(rows: readonly SessionDurationRow[]): number | null {
  if (rows.length === 0) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (const row of rows) {
    if (row.duration_sec !== null && !Number.isNaN(row.duration_sec)) {
      sum += row.duration_sec;
      count += 1;
    }
  }

  return count === 0 ? null : sum / count;
}

/**
 * Calcula la proporción de llamadas a LLM con `status` distinto de 'ok'.
 * Devuelve { rate: 0 a 1, total, failed }. Si no hay filas, rate=0.
 */
export function calculateLlmFailureRate(
  rows: readonly LlmCallRow[],
): { rate: number; total: number; failed: number } {
  const total = rows.length;
  if (total === 0) {
    return { rate: 0, total: 0, failed: 0 };
  }

  const failed = rows.filter((row) => row.status !== 'ok').length;
  const rate = total === 0 ? 0 : failed / total;

  return { rate, total, failed };
}

/**
 * Calcula el día (medianoche UTC) de una fecha.
 */
function dateOnly(date: Date): Date {
  const ms = date.getTime();
  const localOffset = date.getTimezoneOffset() * 60 * 1000;
  const utcMs = ms + localOffset;
  const dayMs = Math.floor(utcMs / DAY_MS) * DAY_MS;
  return new Date(dayMs - localOffset);
}
