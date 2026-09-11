/**
 * Constantes de producto.
 *
 * Fuente: docs/specs/SPEC-04-sesion-de-conversacion.md §1
 * y docs/specs/SPEC-07-gamificacion-y-social.md §1.
 *
 * No hardcodear estos valores en otros archivos: importar desde aquí.
 */

// ---------------------------------------------------------------------------
// SPEC-04 §1 — Sesión de conversación
// ---------------------------------------------------------------------------

/** Duración objetivo de una sesión, en segundos. */
export const SESSION_TARGET_SEC = 600;

/** Segundo en el que la app avisa al usuario de que se acerca el final. */
export const SESSION_WARN_SEC = 480;

/** Segundo en el que la API cierra la sesión sola si sigue abierta. */
export const SESSION_HARD_CAP_SEC = 720;

/** Duración mínima, en segundos, para que la sesión cuente para XP y streak. */
export const MIN_SESSION_SEC = 180;

/** Turnos mínimos del usuario para encolar el job de coaching brief. */
export const MIN_TURNS_FOR_BRIEF = 3;

/** Segundos sin turnos tras los que una sesión activa pasa a `abandoned`. */
export const ABANDON_AFTER_SEC = 1800;

/** Probabilidad (0 a 1) de usar un callback fact al abrir sesión (RF-4.4). */
export const CALLBACK_PROBABILITY = 0.4;

/** Cada cuántas sesiones se ofrece un "boss" (RF-5.3). */
export const BOSS_EVERY_N_SESSIONS = 7;

// ---------------------------------------------------------------------------
// SPEC-07 §1 — Gamificación y social
// ---------------------------------------------------------------------------

/** XP base al cerrar una sesión válida. */
export const XP_SESSION_BASE = 50;

/** XP por minuto entre el minuto 6 y el 10 (máximo 30 en total). */
export const XP_PER_MINUTE_AFTER_5 = 6;

/** Bono de XP por la segunda sesión válida del día. */
export const XP_DOUBLE_DAY_BONUS = 25;

/** Multiplicador de XP (base y duración) para sesiones de tipo "boss". */
export const XP_BOSS_MULTIPLIER = 2;

/** Bono de XP cuando la sesión se abrió desde un desafío. */
export const XP_CHALLENGE_BONUS = 15;

/** Bono de XP al llegar a un múltiplo de 7 días de streak. */
export const XP_STREAK_7_BONUS = 40;

/**
 * XP la primera (y única) vez que el usuario completa su perfil (MEJ-14).
 *
 * Es *endowed progress*: entrar a Home con algo ya ganado sostiene mejor la
 * activación que una barra de nivel en cero.
 */
export const XP_PROFILE_COMPLETED = 20;

/** Sesiones válidas por día que dan XP; la siguiente no da XP. */
export const MAX_VALID_SESSIONS_PER_DAY = 3;

/** Días de gracia de streak disponibles por semana. */
export const GRACE_DAYS_PER_WEEK = 1;

/**
 * Momento de reinicio del leaderboard semanal: lunes 00:00 UTC.
 *
 * Decisión de tipado (sin especificar en la spec, ver docs/specs/pendientes/PR-08.md):
 * se representa como un literal de string legible en vez de un enum, porque
 * hoy solo existe un valor posible y un string documentado es más simple.
 */
export const LEADERBOARD_RESET = 'monday_00_utc' as const;

export type LeaderboardReset = typeof LEADERBOARD_RESET;

/** Un nivel de XP: nombre visible y el XP mínimo para alcanzarlo. */
export interface XpLevel {
  name: string;
  minXp: number;
}

/**
 * Niveles de XP (RF-5.4), sin efecto funcional. Orden ascendente por minXp.
 */
export const XP_LEVELS: readonly XpLevel[] = [
  { name: 'Newcomer', minXp: 0 },
  { name: 'Chatterbox', minXp: 500 },
  { name: 'Storyteller', minXp: 1500 },
  { name: 'Debater', minXp: 3500 },
  { name: 'Native-ish', minXp: 7000 },
] as const;

// ---------------------------------------------------------------------------
// SPEC-07 §7 — Desafíos cruzados (RF-6.4)
//
// Añadidas por PR-02/T7 (docs/specs/pendientes/PR-02.md): SPEC-07 §7 nombra
// estos tres números en prosa ("máximo 3", "últimos 7 días", "practicado en
// 14 días") pero no los había centralizado como constantes. Se agregan aquí,
// junto a las de §1, para que PR-07/T2 (ChallengesService) las reutilice en
// vez de duplicarlas con otro valor.
// ---------------------------------------------------------------------------

/** Máximo de desafíos que devuelve `GET /challenges` (RF-6.4, SPEC-07 §7). */
export const MAX_CHALLENGES = 3;

/** Ventana de sesiones válidas recientes que pueden originar un desafío. */
export const CHALLENGE_SESSION_LOOKBACK_DAYS = 7;

/** Ventana en la que un tema cuenta como "ya practicado" por el usuario. */
export const CHALLENGE_TOPIC_COOLDOWN_DAYS = 14;
