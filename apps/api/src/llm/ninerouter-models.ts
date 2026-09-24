/**
 * Lista fija del operador con los modelos que Fluent expone a través de 9router
 * (arquitectura 001, «Hallazgos del router real», medido el 2026-09-23).
 *
 * `GET {NINEROUTER_URL}/v1/models` decide qué está *disponible*; esta lista decide
 * qué se *ofrece* y con qué datos (`ModelCatalogService.listModels` hace la
 * intersección). Fuera a propósito: los `nvidia/*` de la lista interna de 9router
 * (fin de vida), `openai/*` (rechaza `max_tokens`), `cc/*`, `ag/*`, `gc/*` (cuotas
 * de IDE) y `openrouter/typesafe/*` (no es un modelo de chat).
 *
 * Fuente de los precios (USD por millón de tokens), a revisar por el operador:
 * - `fluent-free`, `nvidia/*`, `cf/*`: 0, son free tiers (NVIDIA NIM, Cloudflare Workers AI).
 * - `fluent-pro`: referencia de su primer modelo (`ds/deepseek-v4-flash`); 9router
 *   no publica precio de un combo.
 * - `ds/deepseek-v4-flash`: tarifa pública de DeepSeek API (cache miss).
 * - `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.8-flash`: tarifa pública de
 *   Google AI Studio, tier de pago.
 * Los `contextLength` son el contexto documentado por cada proveedor.
 */
import type { CatalogModel } from './catalog.service.js';

export const NINEROUTER_MODELS: readonly CatalogModel[] = [
  {
    id: 'fluent-free',
    provider: '9router',
    name: 'Fluent Free',
    tier: 'free',
    pricePerMillionIn: 0,
    pricePerMillionOut: 0,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'fluent-pro',
    provider: '9router',
    name: 'Fluent Pro',
    tier: 'premium',
    pricePerMillionIn: 0.14,
    pricePerMillionOut: 0.28,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'nvidia/nvidia/nemotron-3-super-120b-a12b',
    provider: '9router',
    name: 'Nemotron 3 Super 120B',
    tier: 'free',
    pricePerMillionIn: 0,
    pricePerMillionOut: 0,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'nvidia/mistralai/mistral-nemotron',
    provider: '9router',
    name: 'Mistral Nemotron',
    tier: 'free',
    pricePerMillionIn: 0,
    pricePerMillionOut: 0,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    provider: '9router',
    name: 'Llama 3.3 70B (Cloudflare)',
    tier: 'free',
    pricePerMillionIn: 0,
    pricePerMillionOut: 0,
    contextLength: 24_000,
    reasoningEffort: 'none',
  },
  {
    id: 'cf/@cf/mistralai/mistral-small-3.1-24b-instruct',
    provider: '9router',
    name: 'Mistral Small 3.1 24B (Cloudflare)',
    tier: 'free',
    pricePerMillionIn: 0,
    pricePerMillionOut: 0,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'ds/deepseek-v4-flash',
    provider: '9router',
    name: 'DeepSeek V4 Flash',
    tier: 'budget',
    pricePerMillionIn: 0.14,
    pricePerMillionOut: 0.28,
    contextLength: 128_000,
    reasoningEffort: 'none',
  },
  {
    id: 'gemini/gemini-3.5-flash-lite',
    provider: '9router',
    name: 'Gemini 3.5 Flash-Lite',
    tier: 'budget',
    pricePerMillionIn: 0.1,
    pricePerMillionOut: 0.4,
    contextLength: 1_048_576,
  },
  {
    id: 'gemini/gemini-3.8-flash',
    provider: '9router',
    name: 'Gemini 3.8 Flash',
    tier: 'premium',
    pricePerMillionIn: 0.3,
    pricePerMillionOut: 2.5,
    contextLength: 1_048_576,
    reasoningEffort: 'low',
  },
];

/** Prefijos con el mismo `reasoning_effort` para cualquier modelo que los use. */
const REASONING_EFFORT_PREFIXES: ReadonlyArray<readonly [string, 'none' | 'low']> = [
  ['ds/', 'none'],
  ['gemini/gemini-3.8', 'low'],
];

/** `providerOptions['9router'].reasoningEffort` para un modelo o combo; `undefined` si no aplica. */
export function reasoningEffortFor(modelId: string): string | undefined {
  const exact = NINEROUTER_MODELS.find((model) => model.id === modelId);
  if (exact) return exact.reasoningEffort;
  return REASONING_EFFORT_PREFIXES.find(([prefix]) => modelId.startsWith(prefix))?.[1];
}
