import { createHash } from 'node:crypto';

/**
 * TTL de la caché de introspección de tokens, en segundos (SPEC-02 §2:
 * «clave `auth:<sha256(token)>`, TTL 300 s»).
 *
 * Consecuencia: como máximo una llamada a
 * `GET {INSFORGE_URL}/api/auth/sessions/current` por usuario cada 5 minutos.
 * No hace falta invalidar la caché en logout: el TTL basta (PR-02/T1).
 */
export const AUTH_CACHE_TTL_SECONDS = 300;

/** Prefijo de las claves de Redis de la caché de auth (SPEC-02 §2). */
export const AUTH_CACHE_PREFIX = 'auth:';

/**
 * Clave de Redis para un access token: `auth:<sha256hex(token)>`.
 *
 * Se guarda el hash y no el token: el valor cacheado (el `userId`) no
 * permite recuperar el token, y un volcado de Redis no expone credenciales
 * válidas de InsForge.
 */
export function authCacheKey(accessToken: string): string {
  const hash = createHash('sha256').update(accessToken, 'utf8').digest('hex');
  return `${AUTH_CACHE_PREFIX}${hash}`;
}
