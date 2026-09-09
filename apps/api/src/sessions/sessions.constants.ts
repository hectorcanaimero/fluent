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

// ---------------------------------------------------------------------------
// PR-04/T3 — Cierre (`POST /sessions/:id/end`, SPEC-04 §5)
// ---------------------------------------------------------------------------

/**
 * Límite de filas que lee `EndSessionRepository.countCorrections` para
 * `SessionSummary.correctionsCount` (SPEC-04 §5). Una sesión no puede superar
 * unos pocos cientos de turnos ni siquiera en el peor caso (acotada por
 * `SESSION_HARD_CAP_SEC` y el ritmo de SPEC-02 §7), así que este límite es
 * una red de seguridad generosa, no un recorte esperado en uso normal —mismo
 * criterio que los límites de `src/sessions-query/sessions-query.repository.ts`.
 */
export const SESSION_END_CORRECTIONS_ROW_LIMIT = 500;

// ---------------------------------------------------------------------------
// PR-04/T3 — Sugerencias (`GET /sessions/suggestions`, SPEC-04 §7)
// ---------------------------------------------------------------------------

/** Temas de `TOPICS` que casan con `profiles.interests` (de los 8 totales). */
export const SUGGESTIONS_TOPICS_MATCHING = 6;

/** Total de temas que devuelve `topics` (6 que casan + 2 fuera de intereses). */
export const SUGGESTIONS_TOPICS_TOTAL = 8;

/** Escenarios de `roleplays` que devuelve la sugerencia. */
export const SUGGESTIONS_ROLEPLAYS = 4;

/** Sesiones `roleplay` recientes del usuario que se evitan al sugerir. */
export const SUGGESTIONS_ROLEPLAYS_RECENT_EXCLUDE = 5;

/** Noticias que devuelve la sugerencia. */
export const SUGGESTIONS_NEWS = 4;

/** Antigüedad máxima de una noticia sugerida (SPEC-04 §7: «últimos 3 días»). */
export const SUGGESTIONS_NEWS_MAX_AGE_DAYS = 3;

/**
 * Límite de filas que lee `SuggestionsRepository.listRecentNews`. Con
 * ingesta diaria (`rss-ingest`, SPEC-05 §3) y una ventana de 3 días, el total
 * de candidatas reales es mucho menor; el límite es solo la misma red de
 * seguridad que el resto de consultas del módulo.
 */
export const SUGGESTIONS_NEWS_ROW_LIMIT = 200;

// ---------------------------------------------------------------------------
// PR-04/T3 — Listado y detalle (`GET /sessions`, `GET /sessions/:id`, SPEC-02 §4.3)
// ---------------------------------------------------------------------------

/** `limit` por defecto de `GET /sessions` cuando la app no lo manda. */
export const SESSIONS_LIST_DEFAULT_LIMIT = 20;

/** `limit` máximo aceptado por `GET /sessions`. */
export const SESSIONS_LIST_MAX_LIMIT = 50;

/**
 * Filas de `turns` que trae `GET /sessions/:id`. Una sesión no puede superar
 * unos pocos cientos de turnos (ver `SESSION_END_CORRECTIONS_ROW_LIMIT`); el
 * límite es una red de seguridad, no un recorte esperado en uso normal.
 */
export const SESSION_DETAIL_TURNS_LIMIT = 300;

/** Filas de `corrections` que trae `GET /sessions/:id`. */
export const SESSION_DETAIL_CORRECTIONS_LIMIT = 200;
