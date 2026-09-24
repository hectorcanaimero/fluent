import type { Provider } from './config.js';

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Tokens de una llamada. `null` significa «el proveedor no lo dijo», que no
 * es lo mismo que cero: registrar ceros sesgaba a la baja el coste estimado
 * de `GET /models` (MEJ-29).
 */
export interface LlmUsage {
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
}

/**
 * Estados registrados en `llm_calls.status`.
 * Ver PENDIENTES PEND-01: amplía el conjunto de SPEC-01 §2.14.
 */
export type LlmCallStatus =
  | 'ok'
  | 'invalid_json'
  | 'provider_error'
  | 'rate_limited'
  | 'auth_error'
  | 'no_credits'
  | 'timeout';

export type LlmErrorStatus = Exclude<LlmCallStatus, 'ok'>;

/** Error de una llamada concreta. Nunca contiene la API key. */
export class LlmCallError extends Error {
  readonly name = 'LlmCallError';

  constructor(
    readonly status: LlmErrorStatus,
    readonly provider: Provider,
    readonly model: string,
    readonly latencyMs: number,
    readonly httpStatus?: number,
    /** Fragmento del cuerpo de la respuesta, recortado. Nunca incluye cabeceras. */
    readonly detail?: string,
  ) {
    super(`${status}${httpStatus !== undefined ? ` (HTTP ${httpStatus})` : ''} en ${provider}/${model}`);
  }

  /** ¿Es un fallo de autenticación o de saldo? Entonces no se reintenta con ese proveedor (SPEC-03 §2). */
  get isAuthError(): boolean {
    return this.status === 'auth_error' || this.status === 'no_credits';
  }
}
