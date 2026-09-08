/**
 * Lista fija de modelos de Gemini (SPEC-03 §7).
 *
 * PEND-09 (`docs/specs/pendientes/PR-03.md`): la spec pide una lista fija con "precios de
 * referencia" pero no da los números. Los precios de abajo son precios públicos de
 * referencia por millón de tokens, consultados el 2026-09-08. El operador debe
 * revisarlos antes de producción (pueden haber cambiado).
 *
 * Contexto real: 1 048 576 tokens (1 MiB de tokens) para las tres variantes.
 */
import type { CatalogModel, ModelTier } from './catalog.service.js';

/**
 * Misma regla de tiers que `ModelCatalogService` (SPEC-03 §7), duplicada aquí en vez
 * de importada desde `catalog.service.ts` para no crear un ciclo de imports entre
 * ambos módulos (este fichero alimenta a `catalog.service.ts` con `GEMINI_MODELS`).
 */
function tierFromOutputPrice(pricePerMillionOut: number): ModelTier {
  if (pricePerMillionOut === 0) return 'free';
  if (pricePerMillionOut <= 1) return 'budget';
  return 'premium';
}

interface GeminiModelRef {
  readonly id: string;
  readonly name: string;
  readonly pricePerMillionIn: number;
  readonly pricePerMillionOut: number;
}

const GEMINI_MODEL_REFS: readonly GeminiModelRef[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    pricePerMillionIn: 0.3,
    pricePerMillionOut: 2.5,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    pricePerMillionIn: 0.1,
    pricePerMillionOut: 0.4,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    pricePerMillionIn: 1.25,
    pricePerMillionOut: 10,
  },
];

const GEMINI_CONTEXT_LENGTH = 1_048_576;

export const GEMINI_MODELS: readonly CatalogModel[] = GEMINI_MODEL_REFS.map((ref) => ({
  id: ref.id,
  provider: 'gemini' as const,
  name: ref.name,
  contextLength: GEMINI_CONTEXT_LENGTH,
  pricePerMillionIn: ref.pricePerMillionIn,
  pricePerMillionOut: ref.pricePerMillionOut,
  tier: tierFromOutputPrice(ref.pricePerMillionOut),
}));
