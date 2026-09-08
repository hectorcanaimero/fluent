import type { Provider } from '../db/schema.js';
import type { ProviderConnectionStatus } from '../credentials/credentials.repository.js';
import type { ProviderCredits } from './provider-api.client.js';

/** Respuesta de `POST /providers/openrouter/pkce/start` (SPEC-02 §4.2). */
export interface PkceStartDtoResponse {
  authUrl: string;
  codeVerifierId: string;
}

/**
 * Respuesta de `POST /providers/openrouter/pkce/complete`,
 * `POST /providers/gemini` y `GET /providers/:provider/status`.
 *
 * La app parsea las tres con el **mismo** modelo
 * (`apps/mobile/lib/core/api/models.dart::ProviderStatusResult`:
 * `{ status, lastError, credits }`), así que las tres devuelven esta forma.
 * `provider` es un extra que la app ignora, útil para depurar.
 */
export interface ProviderStatusDto {
  provider: Provider;
  status: ProviderConnectionStatus;
  lastError: string | null;
  /** Solo OpenRouter y solo si la consulta de créditos funcionó (RF-2.3). */
  credits?: ProviderCredits;
}
