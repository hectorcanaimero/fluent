import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEGACY_PROVIDERS as PROVIDERS } from '../llm/config.js';

/**
 * Token de inyección del `fetch` que usan las llamadas salientes a
 * OpenRouter y Gemini.
 *
 * Se inyecta (en vez de usar el global directamente) por el mismo motivo que
 * en `apps/api/src/llm/llm.client.ts` y `catalog.service.ts`: los tests
 * sustituyen este provider por un doble y **nunca** se llama a un proveedor
 * real.
 */
export const PROVIDER_FETCH = Symbol('PROVIDER_FETCH');

export type FetchLike = typeof globalThis.fetch;

/** SPEC-02 §4.2: canje del `code` de PKCE por la key de OpenRouter. */
export const OPENROUTER_KEYS_URL = `${PROVIDERS.openrouter.baseUrl}/auth/keys`;
/** RF-2.3: créditos de OpenRouter. */
export const OPENROUTER_CREDITS_URL = `${PROVIDERS.openrouter.baseUrl}/credits`;
/** SPEC-02 §4.2: validación de la key de Gemini contra `/models`. */
export const GEMINI_MODELS_URL = `${PROVIDERS.gemini.baseUrl}/models`;

/** Estas llamadas son de control, no de conversación: 10 s de sobra. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Créditos de OpenRouter ya normalizados (RF-2.3, contrato de la app). */
export interface ProviderCredits {
  readonly total: number;
  readonly used: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Llamadas salientes a los proveedores que **no** son de conversación
 * (`LlmClient` cubre esas): canjear el `code` de PKCE, validar una key de
 * Gemini y consultar los créditos de OpenRouter.
 *
 * Invariante de seguridad: la key solo viaja en la cabecera `Authorization` o
 * en el cuerpo del canje, y nunca aparece en un log ni en el mensaje de un
 * error de este fichero.
 */
@Injectable()
export class ProviderApiClient {
  private readonly logger = new Logger(ProviderApiClient.name);

  constructor(@Inject(PROVIDER_FETCH) private readonly fetchImpl: FetchLike) {}

  /**
   * Canjea el `code` de PKCE en `POST /api/v1/auth/keys` (SPEC-02 §4.2).
   * Devuelve la key, o `null` si OpenRouter rechaza el canje o la respuesta
   * no trae ninguna key (quien llama lo traduce a `PROVIDER_KEY_INVALID`).
   */
  async exchangeOpenRouterCode(code: string, codeVerifier: string): Promise<string | null> {
    try {
      const response = await this.fetchImpl(OPENROUTER_KEYS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          code_challenge_method: 'S256',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`OpenRouter rechazó el canje del código (HTTP ${response.status}).`);
        return null;
      }

      const body = (await response.json()) as { key?: unknown };
      return typeof body.key === 'string' && body.key.length > 0 ? body.key : null;
    } catch (error) {
      this.logger.warn(`Falló el canje del código con OpenRouter: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Valida una key de Gemini con `GET {baseUrl}/models` (SPEC-02 §4.2). Un
   * 401/403, cualquier otro error HTTP o un fallo de red cuentan como key
   * inválida: no se guarda nada.
   */
  async validateGeminiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.fetchImpl(GEMINI_MODELS_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Gemini rechazó la key al validarla (HTTP ${response.status}).`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`No se pudo validar la key de Gemini: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Créditos de OpenRouter (RF-2.3). La respuesta real es
   * `{ data: { total_credits, total_usage } }`; se mapea de forma defensiva a
   * `{ total, used }` y se devuelve `null` ante cualquier problema, para que
   * `GET /providers/openrouter/status` responda el estado **sin** `credits`
   * en vez de un 500.
   */
  async fetchOpenRouterCredits(apiKey: string): Promise<ProviderCredits | null> {
    try {
      const response = await this.fetchImpl(OPENROUTER_CREDITS_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...PROVIDERS.openrouter.extraHeaders,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`No se pudieron leer los créditos de OpenRouter (HTTP ${response.status}).`);
        return null;
      }

      const body = (await response.json()) as {
        data?: { total_credits?: unknown; total_usage?: unknown };
      };
      const total = body.data?.total_credits;
      const used = body.data?.total_usage;

      if (!isFiniteNumber(total) || !isFiniteNumber(used)) {
        this.logger.warn('La respuesta de créditos de OpenRouter no tiene la forma esperada.');
        return null;
      }

      return { total, used };
    } catch (error) {
      this.logger.warn(
        `No se pudieron leer los créditos de OpenRouter: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
