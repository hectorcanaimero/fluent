/**
 * Funciones puras del banco de pruebas de modelos (`scripts/bench-models.ts`),
 * aquí para poder testearlas sin lanzar el script.
 */
import type { Category, TurnOutput } from './schemas.js';

export interface PlantedError {
  readonly category: Category;
  readonly trigger: string;
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * p50/p90 sobre TODOS los intentos, también los fallidos: un timeout tarda
 * `timeoutMs` y esconderlo dejaría entrar a un modelo que se cuelga.
 */
export function latencyPercentiles(
  outcomes: ReadonlyArray<{ readonly latencyMs: number }>,
): {
  p50: number;
  p90: number;
} {
  const latencies = outcomes.map((o) => o.latencyMs);
  return { p50: percentile(latencies, 50), p90: percentile(latencies, 90) };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Se considera detectado un error plantado si el modelo devolvió una corrección de
 * su misma categoría o cuyo `original` solapa con el fragmento plantado. Un
 * `original` vacío tras normalizar no cuenta: `''` está incluido en cualquier texto.
 */
export function detects(
  planted: PlantedError,
  corrections: TurnOutput['corrections'],
): boolean {
  const trigger = normalize(planted.trigger);
  return corrections.some((correction) => {
    if (correction.category === planted.category) return true;
    const original = normalize(correction.original);
    return (
      original.length > 0 &&
      (original.includes(trigger) || trigger.includes(original))
    );
  });
}
