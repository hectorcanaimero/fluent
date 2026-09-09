/**
 * Constantes y tokens de inyección del módulo de sesiones (SPEC-04).
 *
 * Las constantes de producto (`CALLBACK_PROBABILITY`, `BOSS_EVERY_N_SESSIONS`,
 * …) viven en `src/config/product.ts` y las del módulo LLM en
 * `src/llm/config.ts`: aquí solo van las que ninguno de los dos define.
 */

/**
 * Fuente de aleatoriedad de la decisión de callback (RF-4.4, SPEC-04 §3.3).
 *
 * Token de inyección de una función `() => number` en `[0, 1)`. Por defecto es
 * `Math.random`; los tests la sustituyen por una función fija para comprobar
 * los dos lados de `CALLBACK_PROBABILITY` sin depender del azar.
 */
export const SESSION_RANDOM = Symbol('SESSION_RANDOM');

/** Firma de lo que se inyecta bajo `SESSION_RANDOM`. */
export type SessionRandom = () => number;

/**
 * Antigüedad máxima de una noticia para poder abrir una sesión `news`
 * (SPEC-04 §3.2: «`news` requiere `newsItemId` de los últimos 14 días»). Se
 * compara contra `news_items.day`, la fecha de ingesta del job `rss-ingest`.
 */
export const NEWS_MAX_AGE_DAYS = 14;

/**
 * TTL de la marca de "hoy rechacé el boss" en Redis (24 h). La clave ya lleva
 * el día (`boss:skip:<userId>:<YYYY-MM-DD>`), así que el TTL es solo para que
 * las claves de días pasados no se acumulen en Redis para siempre.
 */
export const BOSS_SKIP_TTL_SECONDS = 24 * 60 * 60;

/** Prefijo de la clave de rechazo diario del boss (docs/tasks/PR-07 T3). */
export const BOSS_SKIP_KEY_PREFIX = 'boss:skip';

/** Índice del turno de apertura del tutor (SPEC-04 §3.5). */
export const OPENING_TURN_IDX = 0;

/** Número máximo de filas de `sessions` que se leen para el histórico de boss. */
export const BOSS_TOPIC_ROW_LIMIT = 500;

/**
 * Lock de turno de SPEC-04 §4: «Concurrencia: lock en Redis
 * `session:<id>:turn` (5 s)». La clave y el TTL son literalmente los de la
 * spec; el valor es irrelevante (basta con que exista), así que se escribe
 * `'1'` igual que en `RedisBossSkipStore`.
 */
export const TURN_LOCK_KEY_PREFIX = 'session';
export const TURN_LOCK_TTL_SECONDS = 5;

/** Clave del lock de turno: `session:<sessionId>:turn` (SPEC-04 §4). */
export function turnLockKey(sessionId: string): string {
  return `${TURN_LOCK_KEY_PREFIX}:${sessionId}:turn`;
}

/**
 * Ritmo de SPEC-02 §7: «un turno como máximo cada 2 segundos por sesión».
 * SPEC-04 no le da nombre a la clave; se elige el mismo espacio de nombres que
 * el lock para que las dos claves de una sesión caduquen juntas y se vean
 * juntas en Redis. Ver docs/specs/pendientes/PR-04.md.
 */
export const TURN_PACE_TTL_SECONDS = 2;

/** Clave de la ventana de ritmo: `session:<sessionId>:pace`. */
export function turnPaceKey(sessionId: string): string {
  return `${TURN_LOCK_KEY_PREFIX}:${sessionId}:pace`;
}

/** Valor que se escribe en las claves que solo importan por existir. */
export const REDIS_FLAG_VALUE = '1';
