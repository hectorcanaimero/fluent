/**
 * Constantes del módulo LLM (SPEC-03 §2, §3 y §4).
 *
 * Ver `docs/specs/pendientes/PR-03.md` PEND-08: las constantes de producto viven en
 * `config/product.ts`, pero ese fichero lo crea otro PR y estas son propias del
 * módulo LLM, así que viven aquí y se reexportarán desde allí sin duplicar valores.
 */

export type Provider = '9router';
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
  '9router': Object.freeze({
    baseUrl: 'http://localhost:20128/v1',
    extraHeaders: Object.freeze({}),
    supportsJsonMode: true,
  }),
});

/** Proveedores previos a 9router; siguen en código hasta F1.2–F1.4 y F5. */
export type LegacyProvider = 'openrouter' | 'gemini';

export const LEGACY_PROVIDERS: Readonly<Record<LegacyProvider, ProviderConfig>> = Object.freeze({
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

export const PROVIDER_IDS: readonly Provider[] = Object.freeze(['9router'] as const);

/** Combos de 9router: el modelo lógico que se pide, no un modelo concreto. */
export const PRO_COMBO = 'fluent-pro';
export const FREE_COMBO = 'fluent-free';

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

/**
 * Intentos para un turno de conversación (MAL-23).
 *
 * Menos que el resto a propósito: el aprendiz está esperando delante de la
 * pantalla, y tres intentos de 25 s son 75 s de silencio antes de rendirse.
 * Con dos, el peor caso baja a 50 s y la apertura degradada aparece antes.
 * El brief y el resumen semanal corren en el worker, sin nadie esperando, y
 * se quedan en `MAX_ATTEMPTS`.
 */
export const TURN_MAX_ATTEMPTS = 2;

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
  Object.freeze({ provider: '9router' as const, model: FREE_COMBO }),
]);

/** SPEC-03 §6: respuesta degradada cuando se agota la cadena en un turno. */
export const DEGRADED_REPLY = 'Sorry, I lost my train of thought. Could you say that again?';

function isProvider(value: unknown): value is Provider {
  return value === '9router';
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
