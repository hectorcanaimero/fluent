/**
 * Catálogo de modelos y estimación de costo por sesión (SPEC-03 §7).
 *
 * Clase pura: no depende de NestJS. La caché y `fetch` se inyectan por constructor
 * para poder testear sin red ni Redis real (PR-08/T3 implementará `CacheStore` con
 * Redis; en tests se usa una implementación en memoria).
 */
import type { Provider } from '../db/schema.js';
import { NINEROUTER_MODELS } from './ninerouter-models.js';

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
  /** `reasoning_effort` que 9router acepta para este modelo; ausente = no se manda. */
  readonly reasoningEffort?: 'none' | 'low';
}

/** SPEC-03 §7: 6 h de caché para el catálogo de 9router. */
export const CACHE_TTL_SECONDS = 6 * 60 * 60;
const CACHE_KEY = 'llm:catalog:9router';

/** SPEC-03 §7: valores por defecto cuando el usuario no tiene historial de sesiones. */
export const DEFAULT_AVG_TOKENS_IN = 9000;
export const DEFAULT_AVG_TOKENS_OUT = 2500;

interface NineRouterModelsResponse {
  readonly data?: ReadonlyArray<{ readonly id?: unknown }>;
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

export interface ModelCatalogServiceOptions {
  readonly cache: CacheStore;
  readonly fetchImpl?: typeof fetch;
  /** `NINEROUTER_URL`. Por defecto, la variable de entorno. */
  readonly baseUrl?: string;
  /** `NINEROUTER_API_KEY` del operador. Por defecto, la variable de entorno. */
  readonly apiKey?: string;
  /** Sobrescribe la lista fija. Por defecto `NINEROUTER_MODELS`. */
  readonly models?: readonly CatalogModel[];
}

export class ModelCatalogService {
  private readonly cache: CacheStore;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly models: readonly CatalogModel[];

  constructor(options: ModelCatalogServiceOptions) {
    this.cache = options.cache;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.baseUrl = (options.baseUrl ?? process.env.NINEROUTER_URL ?? '').replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? process.env.NINEROUTER_API_KEY ?? '';
    this.models = options.models ?? NINEROUTER_MODELS;
  }

  /**
   * Intersección entre `GET {NINEROUTER_URL}/v1/models` (cacheado 6 h) y la lista
   * fija: un id que 9router no devuelve no se expone, y los datos (tier, precio,
   * contexto) son siempre los de la lista fija.
   */
  async listModels(): Promise<CatalogModel[]> {
    const parsed = JSON.parse(await this.fetchRawCatalog()) as NineRouterModelsResponse;
    const available = new Set<unknown>((Array.isArray(parsed.data) ? parsed.data : []).map((m) => m.id));
    return this.models.filter((model) => available.has(model.id));
  }

  /**
   * Descarga el JSON crudo del catálogo (con caché de 6 h) o lanza si no hay forma de
   * obtenerlo. Primero comprueba la caché (así una segunda llamada dentro de las 6 h
   * no vuelve a pegarle a la red); si no hay entrada válida, descarga y cachea.
   */
  private async fetchRawCatalog(): Promise<string> {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached !== null) return cached;

    try {
      return await this.downloadAndCache();
    } catch (error) {
      const cached = await this.cache.get(CACHE_KEY);
      if (cached !== null) return cached;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No se pudo descargar el catálogo de 9router y no hay caché disponible: ${redact(message, this.apiKey)}`,
      );
    }
  }

  /**
   * Fuerza una descarga real del catálogo de 9router, ignorando la caché, y
   * sobreescribe la entrada cacheada (job `model-catalog`, SPEC-05 §8).
   *
   * Si la descarga falla, la excepción se propaga tal cual (sin el mensaje
   * "y no hay caché disponible" de `fetchRawCatalog`, que no aplica aquí) para
   * que el llamador (BullMQ) reintente. La entrada anterior de la caché no se
   * toca hasta que `downloadAndCache` complete un `set` con éxito, así que un
   * fallo de red no borra el catálogo previo (SPEC-05 §8: «si falla, se
   * conserva el anterior»).
   */
  async refresh(): Promise<void> {
    await this.downloadAndCache();
  }

  /** Descarga real (sin mirar la caché) y sobreescribe `CACHE_KEY`. Lanza si la petición falla. */
  private async downloadAndCache(): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
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
