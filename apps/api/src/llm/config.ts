/**
 * Constantes del módulo LLM (SPEC-03 §2, §3 y §4).
 *
 * Ver `docs/specs/PENDIENTES.md` PEND-08: las constantes de producto viven en
 * `config/product.ts`, pero ese fichero lo crea otro PR y estas son propias del
 * módulo LLM, así que viven aquí y se reexportarán desde allí sin duplicar valores.
 */

export type Provider = 'openrouter' | 'gemini';
export type Purpose = 'turn' | 'brief' | 'weekly';
export type Locale = 'es' | 'pt-BR';
export type Level = 'A2' | 'B1' | 'B2';
export type SessionKind = 'free_topic' | 'roleplay' | 'news' | 'boss';

/** SPEC-03 §1: tabla de proveedores. */
export interface ProviderConfig {
  readonly baseUrl: string;
  readonly extraHeaders: Readonly<Record<string, string>>;
  /** Si acepta `response_format: { type: 'json_object' }`. */
  readonly supportsJsonMode: boolean;
}

export const PROVIDERS: Readonly<Record<Provider, ProviderConfig>> = Object.freeze({
  openrouter: Object.freeze({
    baseUrl: 'https://openrouter.ai/api/v1',
    extraHeaders: Object.freeze({
      'HTTP-Referer': 'https://fluent.app',
      'X-Title': 'Fluent',
    }),
    supportsJsonMode: true,
  }),
  gemini: Object.freeze({
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    extraHeaders: Object.freeze({}),
    supportsJsonMode: true,
  }),
});

export const PROVIDER_IDS: readonly Provider[] = Object.freeze(['openrouter', 'gemini'] as const);

/** SPEC-03 §3: presupuesto de contexto por turno. */
export const HISTORY_TURNS = 8;
export const HISTORY_TURN_CHARS = 600;
export const USER_MESSAGE_CHARS = 1000;
export const BRIEF_CHARS = 600;
export const MAX_FACTS_IN_PROMPT = 3;
/** SPEC-03 §4.2: transcript recortado a los últimos 6 000 caracteres. */
export const TRANSCRIPT_CHARS = 6000;

/** SPEC-03 §2 (timeouts) y §3/§4 (temperatura y tokens de salida). */
export interface PurposeDefaults {
  readonly timeoutMs: number;
  readonly temperature: number;
  readonly maxTokens: number;
}

export const PURPOSE_DEFAULTS: Readonly<Record<Purpose, PurposeDefaults>> = Object.freeze({
  turn: Object.freeze({ timeoutMs: 25_000, temperature: 0.7, maxTokens: 350 }),
  brief: Object.freeze({ timeoutMs: 60_000, temperature: 0.3, maxTokens: 800 }),
  weekly: Object.freeze({ timeoutMs: 60_000, temperature: 0.9, maxTokens: 600 }),
});

/** SPEC-03 §2: máximo de intentos por llamada. */
export const MAX_ATTEMPTS = 3;

export interface FallbackModel {
  readonly provider: Provider;
  readonly model: string;
}

/**
 * SPEC-03 §2: valor inicial propuesto de `FALLBACK_MODELS`, pendiente de validar con
 * `scripts/bench-models.ts` (PEND-10). El operador lo sobreescribe con la variable de
 * entorno `FALLBACK_MODELS` (JSON).
 */
export const DEFAULT_FALLBACK_MODELS: readonly FallbackModel[] = Object.freeze([
  Object.freeze({ provider: 'gemini' as const, model: 'gemini-2.5-flash' }),
  Object.freeze({ provider: 'openrouter' as const, model: 'google/gemma-3-27b-it:free' }),
  Object.freeze({
    provider: 'openrouter' as const,
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  }),
  Object.freeze({ provider: 'openrouter' as const, model: 'qwen/qwen3-235b-a22b:free' }),
]);

/** SPEC-03 §6: respuesta degradada cuando se agota la cadena en un turno. */
export const DEGRADED_REPLY = 'Sorry, I lost my train of thought. Could you say that again?';

function isProvider(value: unknown): value is Provider {
  return value === 'openrouter' || value === 'gemini';
}

/** Parsea la variable de entorno `FALLBACK_MODELS`. Ante cualquier error usa el valor por defecto. */
export function parseFallbackModels(raw: string | undefined): readonly FallbackModel[] {
  if (!raw || raw.trim() === '') return DEFAULT_FALLBACK_MODELS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_FALLBACK_MODELS;
  }
  if (!Array.isArray(parsed)) return DEFAULT_FALLBACK_MODELS;
  const out: FallbackModel[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const { provider, model } = item as { provider?: unknown; model?: unknown };
    if (isProvider(provider) && typeof model === 'string' && model.length > 0) {
      out.push({ provider, model });
    }
  }
  return out.length > 0 ? Object.freeze(out) : DEFAULT_FALLBACK_MODELS;
}
