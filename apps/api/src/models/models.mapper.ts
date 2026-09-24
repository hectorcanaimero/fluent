import type { CatalogModel } from '../llm/catalog.service.js';
import type { Provider } from '../db/schema.js';
import type { ModelOptionDto, ModelTierGroupsDto } from './models.types.js';

/**
 * `CatalogModel` (`apps/api/src/llm/catalog.service.ts`, PR-03) → `ModelOption`
 * de la app (docs/specs/pendientes/PR-02.md): `pricePerMillionUsd` es el
 * precio de **salida**, el mismo que decide el tier (`tierFromOutputPrice`).
 */
function toModelOptionDto(model: CatalogModel): ModelOptionDto {
  return { id: model.id, name: model.name, pricePerMillionUsd: model.pricePerMillionOut };
}

function emptyTierGroups(): ModelTierGroupsDto {
  return { free: [], budget: [], premium: [] };
}

/**
 * Agrupa el catálogo completo (OpenRouter + Gemini) en
 * `{ openrouter: { free, budget, premium }, gemini: { free, budget, premium } }`
 * (SPEC-02 §4.2). Las dos claves de proveedor y los tres tiers **siempre**
 * están presentes, aunque queden vacíos — la app los espera así.
 */
export function groupModelsByProviderAndTier(
  models: readonly CatalogModel[],
): Record<Provider, ModelTierGroupsDto> {
  // ponytail: sin clave '9router' hasta que F5 rehaga el catálogo.
  const result = {
    openrouter: emptyTierGroups(),
    gemini: emptyTierGroups(),
  } as Record<Provider, ModelTierGroupsDto>;

  for (const model of models) {
    result[model.provider][model.tier].push(toModelOptionDto(model));
  }

  return result;
}

/**
 * `estimatePerSession` de `GET /models` (SPEC-03 §7): una entrada por
 * modelo del catálogo completo, con el costo estimado de una sesión según
 * los promedios de tokens (del usuario o los valores por defecto).
 */
export function buildEstimatePerSession(
  models: readonly CatalogModel[],
  avgTokensIn: number,
  avgTokensOut: number,
  estimate: (avgIn: number, avgOut: number, model: CatalogModel) => number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const model of models) {
    result[model.id] = estimate(avgTokensIn, avgTokensOut, model);
  }
  return result;
}
