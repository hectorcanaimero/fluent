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

/** Esquema propio de la app (SPEC-06 §7). */
export const APP_CALLBACK_SCHEME = 'fluent:';

/** `code_verifier` aleatorio en base64url (43 caracteres). */
export function generateCodeVerifier(): string {
  return randomBytes(VERIFIER_BYTES).toString('base64url');
}

/** `code_challenge` S256: `base64url(sha256(verifier))`. */
export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/**
 * ¿Es `value` un callback aceptable? **Lista blanca**: solo el deep link de
 * la app (`fluent://…`) o exactamente el callback configurado en
 * `OPENROUTER_OAUTH_CALLBACK` (`configuredCallback`).
 *
 * Antes se admitía cualquier URL absoluta que no usara un esquema peligroso,
 * y ese valor acaba siendo el destino al que el callback HTTPS público
 * redirige el navegador: cualquiera podía convertir un dominio de la API en
 * un redirector abierto hacia su propio sitio (MAL-18). Que el `code` no
 * sirva sin el `code_verifier` no arregla la redirección abierta en sí.
 *
 * La comparación con el configurado es sobre la URL normalizada por `URL`,
 * para que una barra final o un puerto por defecto no cambien el resultado.
 */
export function isValidCallbackUrl(value: string, configuredCallback: string): boolean {
  const parsed = parseCallbackUrl(value);
  if (parsed === null) {
    return false;
  }

  if (parsed.protocol.toLowerCase() === APP_CALLBACK_SCHEME) {
    return true;
  }

  const configured = parseCallbackUrl(configuredCallback);
  return configured !== null && parsed.href === configured.href;
}

/** `URL` de un callback sintácticamente aceptable, o `null`. */
function parseCallbackUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > MAX_CALLBACK_URL_LENGTH || /\s/.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
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
