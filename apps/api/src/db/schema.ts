/**
 * Tipos del esquema de datos · GENERADO A MANO a partir de las migraciones
 *
 * Cada interface corresponde a una tabla o vista en el SQL. Los nombres de
 * columna son exactamente como en las migraciones (snake_case). Si una migración
 * cambia, este fichero debe actualizarse manualmente.
 *
 * Migraciones de origen:
 * - 20260908171114_grupos-invitaciones-perfiles.sql
 * - 20260908190234_proveedores-y-preferencias-de-modelo.sql
 * - 20260908190806_sesiones-turnos-correcciones.sql
 * - 20260908191227_memoria-hechos-y-brief.sql
 * - 20260908191927_noticias-y-social.sql
 */

/* ============================================================================
   Tipos unión (CHECKs de lista cerrada en SQL)
   ========================================================================== */

/** Nivel de idioma (SPEC-01 §2.1, §2.10) */
export type Level = 'A2' | 'B1' | 'B2';

/** Idioma de UI y notas (SPEC-01 §2.1) */
export type Locale = 'es' | 'pt-BR';

/** Proveedor de LLM (SPEC-01 §2.4, §2.5) */
export type Provider = 'openrouter' | 'gemini';

/** Estado de la credencial de proveedor (SPEC-01 §2.4) */
export type CredentialStatus = 'active' | 'revoked' | 'error';

/** Tipo de sesión (SPEC-01 §2.6) */
export type SessionKind = 'free_topic' | 'roleplay' | 'news' | 'boss';

/** Estado de la sesión (SPEC-01 §2.6) */
export type SessionStatus = 'active' | 'ended' | 'abandoned';

/** Estado del job de coaching brief (SPEC-01 §2.6) */
export type BriefJobStatus = 'pending' | 'running' | 'done' | 'failed';

/** Rol en un turno (SPEC-01 §2.7) */
export type TurnRole = 'user' | 'tutor';

/** Categorías de corrección (SPEC-01 §2.8, catálogo en §4) */
export type CorrectionCategory =
  | 'past_simple'
  | 'present_perfect'
  | 'articles'
  | 'prepositions'
  | 'word_order'
  | 'subject_verb'
  | 'plurals'
  | 'vocabulary'
  | 'pronunciation_hint'
  | 'false_friend'
  | 'phrasal_verb'
  | 'conditional'
  | 'modal'
  | 'other';

/** Estado de un hecho (SPEC-01 §2.9) */
export type FactStatus = 'pending' | 'confirmed' | 'dismissed';

/** Tipo de evento de XP (SPEC-01 §2.13, SPEC-07 §2) */
export type XpEventKind =
  | 'session'
  | 'duration_bonus'
  | 'double_day'
  | 'boss'
  | 'challenge'
  | 'streak_7'
  /** MEJ-14: una sola vez por usuario, sin `session_id`. */
  | 'profile_completed';

/** Propósito de una llamada a LLM (SPEC-01 §2.14) */
export type LlmCallPurpose = 'turn' | 'brief' | 'weekly';

/** Estado de una llamada a LLM (SPEC-01 §2.14) */
export type LlmCallStatus =
  | 'ok'
  | 'invalid_json'
  | 'provider_error'
  | 'rate_limited'
  | 'fallback'
  | 'auth_error'
  | 'no_credits'
  | 'timeout';

/* ============================================================================
   Tipos complejos
   ========================================================================== */

/** Elemento del array recurring_errors en coaching_briefs (SPEC-01 §2.10) */
export interface RecurringError {
  category: string;
  example?: string;
}

/* ============================================================================
   Interfaces de tablas
   ========================================================================== */

/**
 * Perfil de usuario (SPEC-01 §2.1)
 * Tabla: profiles
 */
export interface Profile {
  user_id: string;
  group_id: string | null;
  display_name: string;
  level: Level;
  suggested_level: Level | null;
  interests: string[];
  timezone: string;
  locale: Locale;
  xp: number;
  streak: number;
  longest_streak: number;
  last_session_day: string | null; // ISO 8601 date (PostgREST serializa date como string)
  grace_used_week: string | null; // ISO 8601 date
  /** MAL-24: cuándo gastó su sesión de cortesía; `null` si aún le queda. */
  courtesy_session_used_at: string | null; // ISO 8601 timestamp
  sessions_count: number;
  onboarded_at: string | null; // ISO 8601 timestamp (PostgREST serializa timestamptz como string)
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Grupo de usuarios (SPEC-01 §2.2)
 * Tabla: groups
 */
export interface Group {
  id: string;
  name: string;
  owner_id: string | null;
  group_streak: number;
  group_streak_day: string | null; // ISO 8601 date (añadido en migración 5)
  is_default: boolean; // grupo al que entra todo perfil nuevo (20260919160000)
  created_at: string; // ISO 8601 timestamp
}

/**
 * Invitación a un grupo (SPEC-01 §2.3)
 * Tabla: invitations
 */
export interface Invitation {
  code: string;
  group_id: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null; // ISO 8601 timestamp
  expires_at: string; // ISO 8601 timestamp
}

/**
 * Miembro de un grupo (vista group_members, SPEC-01 §3, RF-6.5)
 * Vista: group_members
 */
export interface GroupMember {
  user_id: string;
  display_name: string;
  level: Level;
  xp: number;
  streak: number;
  last_session_day: string | null; // ISO 8601 date
  group_id: string | null;
}

/**
 * Credencial de proveedor (SPEC-01 §2.4)
 * Tabla: provider_credentials
 */
export interface ProviderCredential {
  id: string;
  user_id: string;
  provider: Provider;
  key_ciphertext: string; // PostgREST serializa bytea como texto; la API nunca debe loguearlo
  key_iv: string; // 12 bytes serializados como texto
  key_tag: string; // 16 bytes serializados como texto
  status: CredentialStatus;
  last_error: string | null;
  connected_at: string; // ISO 8601 timestamp
}

/**
 * Preferencias de modelo (SPEC-01 §2.5, RF-2.6, RF-2.7)
 * Tabla: model_preferences
 */
export interface ModelPreference {
  user_id: string;
  chat_provider: Provider;
  chat_model: string;
  brief_provider: Provider;
  brief_model: string;
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Sesión de aprendizaje (SPEC-01 §2.6)
 * Tabla: sessions
 */
export interface Session {
  id: string;
  user_id: string;
  kind: SessionKind;
  topic: string;
  news_item_id: string | null;
  challenge_from_user_id: string | null;
  status: SessionStatus;
  started_at: string; // ISO 8601 timestamp
  ended_at: string | null; // ISO 8601 timestamp
  duration_sec: number | null;
  turns_count: number;
  xp_earned: number;
  chat_model_used: string | null;
  callback_fact_id: string | null;
  brief_job_status: BriefJobStatus;
  /** MAL-24: corre con la credencial del owner del grupo. */
  courtesy: boolean;
}

/**
 * Turno de conversación (SPEC-01 §2.7)
 * Tabla: turns
 */
export interface Turn {
  id: string;
  session_id: string;
  idx: number;
  role: TurnRole;
  text: string;
  model: string | null; // solo para role='tutor'
  tokens_in: number | null; // solo para role='tutor'
  tokens_out: number | null; // solo para role='tutor'
  latency_ms: number | null; // solo para role='tutor'
  created_at: string; // ISO 8601 timestamp
}

/**
 * Corrección de un turno (SPEC-01 §2.8)
 * Tabla: corrections
 */
export interface Correction {
  id: string;
  session_id: string;
  user_id: string;
  turn_idx: number;
  original: string;
  corrected: string;
  category: CorrectionCategory;
  note: string | null;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Evento de XP (auditoría, SPEC-01 §2.13)
 * Tabla: xp_events
 */
export interface XpEvent {
  id: string;
  user_id: string;
  session_id: string | null;
  kind: XpEventKind;
  amount: number;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Registro de llamada a LLM (observabilidad, SPEC-01 §2.14)
 * Tabla: llm_calls
 */
export interface LlmCall {
  id: string;
  user_id: string | null;
  session_id: string | null;
  purpose: LlmCallPurpose;
  provider: string | null;
  model: string | null;
  prompt_version: number;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  status: LlmCallStatus;
  attempt: number;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Hecho sobre el usuario (SPEC-01 §2.9)
 * Tabla: facts
 */
export interface Fact {
  id: string;
  user_id: string;
  text: string;
  happens_on: string | null; // ISO 8601 date
  status: FactStatus;
  source_session_id: string | null;
  last_used_at: string | null; // ISO 8601 timestamp
  use_count: number;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Coaching brief (resumen de puntos de mejora, SPEC-01 §2.10)
 * Tabla: coaching_briefs
 */
export interface CoachingBrief {
  user_id: string;
  text: string;
  level_hint: Level | null;
  recurring_errors: RecurringError[];
  source_session_id: string | null;
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Histórico de coaching brief (SPEC-01 §2.10)
 * Tabla: coaching_brief_history
 */
export interface CoachingBriefHistory {
  id: string;
  user_id: string;
  text: string;
  level_hint: Level | null;
  recurring_errors: RecurringError[];
  source_session_id: string | null;
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Noticia (SPEC-01 §2.11)
 * Tabla: news_items
 */
export interface NewsItem {
  id: string;
  source: string;
  url: string;
  title: string;
  summary: string | null;
  tags: string[];
  published_at: string | null; // ISO 8601 timestamp
  day: string; // ISO 8601 date
}

/**
 * Resumen semanal de grupo (SPEC-01 §2.12)
 * Tabla: weekly_summaries
 */
export interface WeeklySummary {
  id: string;
  group_id: string;
  week_start: string; // ISO 8601 date (lunes)
  text: string;
  stats: Record<string, unknown>; // JSON arbitrario, lo pasó el modelo
  created_at: string; // ISO 8601 timestamp
}

/* ============================================================================
   Constantes de tablas y vistas (para usar en repos sin strings sueltos)
   ========================================================================== */

export const TABLES = {
  profiles: 'profiles',
  groups: 'groups',
  invitations: 'invitations',
  groupMembers: 'group_members',
  providerCredentials: 'provider_credentials',
  modelPreferences: 'model_preferences',
  sessions: 'sessions',
  turns: 'turns',
  corrections: 'corrections',
  xpEvents: 'xp_events',
  llmCalls: 'llm_calls',
  facts: 'facts',
  coachingBriefs: 'coaching_briefs',
  coachingBriefHistory: 'coaching_brief_history',
  newsItems: 'news_items',
  weeklySummaries: 'weekly_summaries',
} as const;
