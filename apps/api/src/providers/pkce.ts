/**
 * PKCE de OpenRouter (SPEC-02 §4.2, SPEC-06 §7, RF-2.1).
 *
 * Módulo puro (`node:crypto`): genera el `code_verifier`, su `code_challenge`
 * S256 y la URL de autorización que la app abre con `flutter_web_auth_2`.
 *
 * El `code_verifier` **nunca** sale de la API: se guarda en Redis 10 minutos
 * (`PkceStore`) y la app solo maneja un id opaco, así que la key resultante
 * tampoco pasa nunca por el dispositivo (SPEC-06 §7).
 */
import { createHash, randomBytes } from 'node:crypto';

/** Página de autorización de OpenRouter (SPEC-02 §4.2). */
export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';

/**
 * Bytes aleatorios del `code_verifier`. En base64url, 32 bytes son 43
 * caracteres: el mínimo que exige RFC 7636 (43..128 caracteres del alfabeto
 * no reservado), y base64url ya usa solo ese alfabeto.
 */
const VERIFIER_BYTES = 32;

/** Longitud máxima razonable de un `callbackUrl` (deep link de la app). */
export const MAX_CALLBACK_URL_LENGTH = 2048;

/**
 * Esquemas que nunca son un callback legítimo: son vectores de ejecución en
 * un navegador o lectores de disco, no destinos de un deep link.
 */
const FORBIDDEN_CALLBACK_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:']);

/** `code_verifier` aleatorio en base64url (43 caracteres). */
export function generateCodeVerifier(): string {
  return randomBytes(VERIFIER_BYTES).toString('base64url');
}

/** `code_challenge` S256: `base64url(sha256(verifier))`. */
export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/**
 * ¿Es `value` un callback aceptable? Se admite cualquier URL absoluta con
 * esquema (incluidos los deep links de la app, `fluent://oauth/openrouter`,
 * SPEC-06 §7) salvo los esquemas peligrosos. No se restringe a un host
 * concreto: el callback lo elige la app y OpenRouter solo lo usa para
 * devolver el `code`, que sin el `code_verifier` (que se queda en Redis) no
 * sirve para nada.
 */
export function isValidCallbackUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > MAX_CALLBACK_URL_LENGTH || /\s/.test(trimmed)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  return !FORBIDDEN_CALLBACK_SCHEMES.has(parsed.protocol.toLowerCase());
}

/**
 * URL de autorización de OpenRouter (SPEC-02 §4.2), con los parámetros
 * codificados por `URLSearchParams`:
 * `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256`.
 */
export function buildOpenRouterAuthUrl(callbackUrl: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${OPENROUTER_AUTH_URL}?${params.toString()}`;
}
