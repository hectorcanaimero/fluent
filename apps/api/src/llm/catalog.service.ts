/**
 * Catálogo de modelos y estimación de costo por sesión (SPEC-03 §7).
 *
 * Clase pura: no depende de NestJS. La caché y `fetch` se inyectan por constructor
 * para poder testear sin red ni Redis real (PR-08/T3 implementará `CacheStore` con
 * Redis; en tests se usa una implementación en memoria).
 */
import { PROVIDERS, type Provider } from './config.js';
import { GEMINI_MODELS } from './gemini-models.js';

/**
 * Almacén de caché mínimo. PR-08/T3 lo implementará con Redis; en tests se usa una
 * implementación en memoria.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export type ModelTier = 'free' | 'budget' | 'premium';

export interface CatalogModel {
  readonly id: string;
  readonly provider: Provider;
  readonly name: string;
  readonly contextLength: number;
  /** USD por millón de tokens. */
  readonly pricePerMillionIn: number;
  readonly pricePerMillionOut: number;
  readonly tier: ModelTier;
}

/** SPEC-03 §7: 6 h de caché para el catálogo de OpenRouter. */
export const CACHE_TTL_SECONDS = 6 * 60 * 60;
const CACHE_KEY = 'llm:catalog:openrouter';

/** SPEC-03 §7: contexto mínimo para no descartar el modelo. */
const MIN_CONTEXT_LENGTH = 8000;

/** SPEC-03 §7: valores por defecto cuando el usuario no tiene historial de sesiones. */
export const DEFAULT_AVG_TOKENS_IN = 9000;
export const DEFAULT_AVG_TOKENS_OUT = 2500;

interface OpenRouterArchitecture {
  readonly modality?: unknown;
  readonly input_modalities?: unknown;
  readonly output_modalities?: unknown;
}

interface OpenRouterPricing {
  readonly prompt?: unknown;
  readonly completion?: unknown;
}

interface OpenRouterRawModel {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly context_length?: unknown;
  readonly architecture?: OpenRouterArchitecture;
  readonly pricing?: OpenRouterPricing;
}

interface OpenRouterModelsResponse {
  readonly data?: readonly OpenRouterRawModel[];
}

/**
 * Último cinturón de seguridad: por si el mensaje de un error de red llegara a
 * contener la key (no debería, ya que solo viaja en la cabecera `Authorization`),
 * se borra antes de que llegue a un log o a una excepción visible.
 */
function redact(text: string, apiKey: string | undefined): string {
  if (apiKey === undefined || apiKey.length === 0) return text;
  return text.split(apiKey).join('[REDACTED]');
}

/** Tier por precio de salida por millón de tokens (SPEC-03 §7). */
export function tierFromOutputPrice(pricePerMillionOut: number): ModelTier {
  if (pricePerMillionOut === 0) return 'free';
  if (pricePerMillionOut <= 1) return 'budget';
  return 'premium';
}

/** Convierte un precio de OpenRouter (string, USD por token) a USD por millón de tokens. */
function parsePricePerMillion(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value * 1_000_000;
}

/**
 * SPEC-03 §7: se excluyen los modelos sin `text` en las modalidades de entrada o de
 * salida. Se usan `architecture.input_modalities` / `output_modalities`; si no
 * existen (formato antiguo de OpenRouter), se cae a `architecture.modality`
 * (formato `"in1+in2->out1+out2"`).
 */
function hasTextModalities(architecture: OpenRouterArchitecture | undefined): boolean {
  if (!architecture) return false;

  const input = architecture.input_modalities;
  const output = architecture.output_modalities;
  if (Array.isArray(input) && Array.isArray(output)) {
    return input.includes('text') && output.includes('text');
  }

  const modality = architecture.modality;
  if (typeof modality === 'string') {
    const [inPart, outPart] = modality.split('->');
    const inputModalities = (inPart ?? '').split('+');
    const outputModalities = (outPart ?? '').split('+');
    return inputModalities.includes('text') && outputModalities.includes('text');
  }

  return false;
}

function parseOpenRouterModel(raw: OpenRouterRawModel): CatalogModel | null {
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (!hasTextModalities(raw.architecture)) return null;

  const contextLength = typeof raw.context_length === 'number' ? raw.context_length : 0;
  if (contextLength < MIN_CONTEXT_LENGTH) return null;

  const pricePerMillionIn = parsePricePerMillion(raw.pricing?.prompt);
  const pricePerMillionOut = parsePricePerMillion(raw.pricing?.completion);
  if (pricePerMillionIn === null || pricePerMillionOut === null) return null;

  const name = typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : raw.id;

  return {
    id: raw.id,
    provider: 'openrouter',
    name,
    contextLength,
    pricePerMillionIn,
    pricePerMillionOut,
    tier: tierFromOutputPrice(pricePerMillionOut),
  };
}

export interface ModelCatalogServiceOptions {
  readonly cache: CacheStore;
  readonly fetchImpl?: typeof fetch;
  /** Sobrescribe la lista fija de Gemini. Por defecto `GEMINI_MODELS`. */
  readonly geminiModels?: readonly CatalogModel[];
}

export class ModelCatalogService {
  private readonly cache: CacheStore;
  private readonly fetchImpl: typeof fetch;
  private readonly geminiModels: readonly CatalogModel[];

  constructor(options: ModelCatalogServiceOptions) {
    this.cache = options.cache;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.geminiModels = options.geminiModels ?? GEMINI_MODELS;
  }

  /** Catálogo de OpenRouter (descargado o de caché) más la lista fija de Gemini. */
  async listModels(apiKey?: string): Promise<CatalogModel[]> {
    const openRouterModels = await this.listOpenRouterModels(apiKey);
    return [...openRouterModels, ...this.geminiModels];
  }

  /**
   * SPEC-03 §7: `GET ${baseUrl}/models`, cacheado 6 h. Si la descarga falla y hay
   * caché, se usa la caché; si falla y no hay caché, se lanza un error claro.
   *
   * La API key nunca se registra ni se serializa: solo se usa, si se pasa, para
   * construir la cabecera `Authorization` de la petición.
   */
  async listOpenRouterModels(apiKey?: string): Promise<CatalogModel[]> {
    const rawJson = await this.fetchRawCatalog(apiKey);
    const parsed = JSON.parse(rawJson) as OpenRouterModelsResponse;
    const data = Array.isArray(parsed.data) ? parsed.data : [];

    const models: CatalogModel[] = [];
    for (const raw of data) {
      const model = parseOpenRouterModel(raw);
      if (model !== null) models.push(model);
    }
    return models;
  }

  /**
   * Descarga el JSON crudo del catálogo (con caché de 6 h) o lanza si no hay forma de
   * obtenerlo. Primero comprueba la caché (así una segunda llamada dentro de las 6 h
   * no vuelve a pegarle a la red); si no hay entrada válida, descarga y cachea.
   */
  private async fetchRawCatalog(apiKey?: string): Promise<string> {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached !== null) return cached;

    try {
      return await this.downloadAndCache(apiKey);
    } catch (error) {
      const cached = await this.cache.get(CACHE_KEY);
      if (cached !== null) return cached;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No se pudo descargar el catálogo de OpenRouter y no hay caché disponible: ${redact(message, apiKey)}`,
      );
    }
  }

  /**
   * Fuerza una descarga real del catálogo de OpenRouter, ignorando la caché, y
   * sobreescribe la entrada cacheada (job `model-catalog`, SPEC-05 §8).
   *
   * Si la descarga falla, la excepción se propaga tal cual (sin el mensaje
   * "y no hay caché disponible" de `fetchRawCatalog`, que no aplica aquí) para
   * que el llamador (BullMQ) reintente. La entrada anterior de la caché no se
   * toca hasta que `downloadAndCache` complete un `set` con éxito, así que un
   * fallo de red no borra el catálogo previo (SPEC-05 §8: «si falla, se
   * conserva el anterior»).
   */
  async refresh(apiKey?: string): Promise<void> {
    await this.downloadAndCache(apiKey);
  }

  /** Descarga real (sin mirar la caché) y sobreescribe `CACHE_KEY`. Lanza si la petición falla. */
  private async downloadAndCache(apiKey?: string): Promise<string> {
    const headers: Record<string, string> = { ...PROVIDERS.openrouter.extraHeaders };
    if (apiKey !== undefined && apiKey.length > 0) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await this.fetchImpl(`${PROVIDERS.openrouter.baseUrl}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`respuesta HTTP ${response.status}`);
    }

    const rawJson = await response.text();
    // Se cachea el JSON crudo, tal cual llega, sin la key (que nunca formó parte
    // del cuerpo de la respuesta).
    await this.cache.set(CACHE_KEY, rawJson, CACHE_TTL_SECONDS);
    return rawJson;
  }

  /** SPEC-03 §7: `avgTokensIn * priceIn + avgTokensOut * priceOut`, en USD. */
  estimatePerSession(avgTokensIn: number, avgTokensOut: number, model: CatalogModel): number {
    const priceInPerToken = model.pricePerMillionIn / 1_000_000;
    const priceOutPerToken = model.pricePerMillionOut / 1_000_000;
    return avgTokensIn * priceInPerToken + avgTokensOut * priceOutPerToken;
  }

  /** Igual que `estimatePerSession` pero con los promedios por defecto de SPEC-03 §7. */
  estimatePerSessionWithDefaults(model: CatalogModel): number {
    return this.estimatePerSession(DEFAULT_AVG_TOKENS_IN, DEFAULT_AVG_TOKENS_OUT, model);
  }
}
