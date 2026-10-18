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
 * - 20260923130000_planes.sql
 * - 20261006120000_sesion-grupal.sql
 * - 20261018130000_simulador-entrevistas.sql
 */

import type {
  InterviewFeedback,
  InterviewPlan,
  InterviewStatus,
  InterviewType,
  PrepStep,
  SeniorityLevel,
} from '../interviews/interviews.types.js';

/* ============================================================================
   Tipos unión (CHECKs de lista cerrada en SQL)
   ========================================================================== */

/** Nivel de idioma (SPEC-01 §2.1, §2.10) */
export type Level = 'A2' | 'B1' | 'B2';

/** Idioma de UI y notas (SPEC-01 §2.1) */
export type Locale = 'es' | 'pt-BR';

/** Plan de suscripción del usuario */
export type Plan = 'free' | 'pro';

/** Proveedor de LLM (SPEC-01 §2.4, §2.5) */
export type Provider = '9router';

/**
 * Tipo de sesión (SPEC-01 §2.6). `'group'`: F6, fila por participante al
 * cerrar la sala. `'interview'`/`'study'`: F10, turno de entrevista y sesión
 * del ciclo de estudio (docs/arch/003-simulador-entrevistas.md §Data model).
 */
export type SessionKind =
  | 'free_topic'
  | 'roleplay'
  | 'news'
  | 'boss'
  | 'group'
  | 'interview'
  | 'study';

/**
 * `kind` que se abre por `POST /sessions`. La sala grupal (`'group'`) se abre
 * por `POST group-sessions` (F6.3); `'interview'` y `'study'` los abre el
 * módulo `interviews` (F10.3) por sus propias rutas.
 */
export type OpenableSessionKind = Exclude<SessionKind, 'group' | 'interview' | 'study'>;

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
  | 'profile_completed'
  /** F6/F9: cierre de una sala grupal. */
  | 'group';

/** Tipo de sala grupal (docs/arch/002-sesion-grupal.md §Data model). Sin `'boss'`. */
export type GroupSessionKind = 'free_topic' | 'roleplay' | 'news';

/** Estado de la sala grupal (docs/arch/002-sesion-grupal.md §Data model) */
export type GroupSessionStatus = 'active' | 'ended';

/** Motivo de cierre de la sala grupal (docs/arch/002-sesion-grupal.md §Data model) */
export type GroupSessionEndReason = 'initiator' | 'max_duration' | 'idle';

/** Rol de un mensaje de sala grupal (docs/arch/002-sesion-grupal.md §Data model) */
export type GroupMessageRole = 'user' | 'tutor' | 'system';

/** Evento de sistema en un mensaje de sala grupal (FR-14) */
export type GroupSystemEvent =
  | 'joined'
  | 'left'
  | 'ending_soon'
  | 'ended'
  | 'tutor_unavailable';

/**
 * Propósito de una llamada a LLM (SPEC-01 §2.14). `interview*`: F10, turno,
 * preparación y parecer del simulador de entrevistas. `llm/config.ts` lo
 * reexporta como `Purpose`.
 */
export type LlmCallPurpose =
  | 'turn'
  | 'brief'
  | 'weekly'
  | 'interview'
  | 'interview_prepare'
  | 'interview_feedback';

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
  plan: Plan;
  /** Fin del plan pro; `null` = sin vencimiento. */
  plan_expires_at: string | null; // ISO 8601 timestamp
  /** Foto del login social (https), copiada de InsForge al crear el perfil. */
  avatar_url: string | null;
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
  /** Sala grupal de origen cuando `kind = 'group'` (F6). */
  group_session_id: string | null;
  /** Entrevista de la sesión cuando `kind = 'interview'` (F10.1.T1). */
  interview_id: string | null;
  /** Tiempo activo acumulado en segundos (D4); solo lo usa `interview`. */
  active_sec: number;
  /** Sesión del ciclo de estudio cuando `kind = 'study'` (F13.1.T1). */
  study_cycle_session_id: string | null;
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
  /** Pregunta del plan (1..8) y si es repregunta; solo en `kind = 'interview'` (F12.1.T2). */
  question_idx: number | null;
  is_follow_up: boolean | null;
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

/**
 * Sala grupal por texto (docs/arch/002-sesion-grupal.md §Data model, F6)
 * Tabla: group_sessions
 */
export interface GroupSession {
  id: string;
  group_id: string;
  initiator_id: string;
  kind: GroupSessionKind;
  topic: string | null;
  roleplay_id: string | null;
  news_item_id: string | null;
  status: GroupSessionStatus;
  end_reason: GroupSessionEndReason | null;
  started_at: string; // ISO 8601 timestamp
  ended_at: string | null; // ISO 8601 timestamp
  last_message_at: string; // ISO 8601 timestamp
  warned_at: string | null; // ISO 8601 timestamp
  recap: Record<string, unknown> | null; // GroupRecapOutput (F9.2)
}

/**
 * Participante de una sala grupal (docs/arch/002-sesion-grupal.md §Data model, F6)
 * Tabla: group_session_participants
 */
export interface GroupSessionParticipant {
  session_id: string;
  user_id: string;
  joined_at: string; // ISO 8601 timestamp
  left_at: string | null; // ISO 8601 timestamp, null = activo
  present_sec: number;
  share_corrections: boolean;
  messages_count: number;
}

/**
 * Mensaje de una sala grupal (docs/arch/002-sesion-grupal.md §Data model, F6)
 * Tabla: group_session_messages
 */
export interface GroupSessionMessage {
  id: number;
  session_id: string;
  role: GroupMessageRole;
  author_id: string | null; // null para tutor y sistema
  text: string;
  audio_key: string | null; // F8
  audio_ms: number | null; // F8
  system_event: GroupSystemEvent | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Corrección de un mensaje de sala grupal (docs/arch/002-sesion-grupal.md §Data model, F6)
 * Tabla: group_session_corrections
 */
export interface GroupSessionCorrection {
  id: number;
  session_id: string;
  message_id: number;
  user_id: string; // autor del mensaje corregido
  original: string;
  corrected: string;
  category: CorrectionCategory;
  note: string | null;
}

/**
 * Entrevista del simulador (docs/arch/003-simulador-entrevistas.md §Data
 * model, F10). Tabla: interviews.
 *
 * `plan`/`feedback` reutilizan los tipos de I1 (`interviews.types.ts`, F10.1)
 * en vez de duplicar sus formas aquí: son el mismo contrato que valida la
 * respuesta de `interview-agent`, y `plan.questions` solo debe llegar hasta
 * `interview-agent.client.ts`/el job de preparación — nunca a un DTO de
 * salida de la API (FR-7).
 */
export interface Interview {
  id: string;
  user_id: string;
  parent_interview_id: string | null;
  type: InterviewType;
  offer_text: string | null;
  offer_url: string | null;
  offer_hash: string;
  status: InterviewStatus;
  prep_step: PrepStep | null;
  company: { name: string; industry?: string; city?: string; workMode?: string } | null;
  role: string | null;
  area: string | null;
  seniority: SeniorityLevel | null;
  plan: InterviewPlan | null;
  feedback: InterviewFeedback | null;
  error_code: string | null;
  answered_count: number;
  /** `too_short` que se puede retomar en su misma sesión (D5, F12.1.T2). */
  resumable: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/** Ciclo de estudio de una entrevista (F13). Tabla: study_cycles. */
export interface StudyCycle {
  id: string;
  user_id: string;
  interview_id: string;
  status: 'active' | 'completed' | 'skipped';
  created_at: string; // ISO 8601 timestamp
}

/** Una de las 5 sesiones del ciclo (F13). Tabla: study_cycle_sessions. */
export interface StudyCycleSession {
  id: string;
  cycle_id: string;
  idx: number;
  focus: string;
  title: string;
  format: 'guided' | 'roleplay';
  est_min: number;
  brief: string;
  done_at: string | null; // ISO 8601 timestamp
}

/* ============================================================================
   Constantes de tablas y vistas (para usar en repos sin strings sueltos)
   ========================================================================== */

export const TABLES = {
  profiles: 'profiles',
  groups: 'groups',
  invitations: 'invitations',
  groupMembers: 'group_members',
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
  badges: 'badges',
  userBadges: 'user_badges',
  pushTokens: 'push_tokens',
  groupSessions: 'group_sessions',
  groupSessionParticipants: 'group_session_participants',
  groupSessionMessages: 'group_session_messages',
  groupSessionCorrections: 'group_session_corrections',
  interviews: 'interviews',
  studyCycles: 'study_cycles',
  studyCycleSessions: 'study_cycle_sessions',
} as const;
