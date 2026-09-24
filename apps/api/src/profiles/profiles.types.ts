import type { Level, Locale, Plan } from '../db/schema.js';

/**
 * `profile` de `GET /me` y cuerpo de `PUT /me/profile` (SPEC-02 §4.1).
 * Nombres de campo exactamente como los espera
 * `apps/mobile/lib/core/api/models.dart::Profile` (no se toca ese archivo).
 */
export interface ProfileDto {
  displayName: string;
  level: Level;
  interests: string[];
  timezone: string;
  locale: Locale;
  xp: number;
  streak: number;
  lastSessionDay: string | null;
  /** Foto del login social; `null` si no hay (se muestra la inicial). */
  avatarUrl: string | null;
}

/** `group` de `GET /me`, `POST /invitations/redeem` y `GET /group` (envuelto según el endpoint). */
export interface GroupDto {
  id: string;
  name: string;
  groupStreak: number;
  /** Grupo por defecto: un código de invitación puede sacar al usuario de él. */
  isDefault: boolean;
}

/** `modelPreference` de `GET /me`, o `null` si el usuario no la tiene todavía. */
export interface ModelPreferenceDto {
  chatProvider: string | null;
  chatModel: string | null;
  briefProvider: string | null;
  briefModel: string | null;
}

/** Respuesta completa de `GET /me` (SPEC-02 §4.1, SPEC-06 §3). */
export interface MeDto {
  profile: ProfileDto;
  group: GroupDto | null;
  /** Plan efectivo: `pro` vencido cuenta como `free` (`profiles/plan.ts`). */
  plan: Plan;
  /** Fin del plan pro; `null` = sin vencimiento. */
  planExpiresAt: string | null;
  modelPreference: ModelPreferenceDto | null;
  onboarded: boolean;
  activeSessionId: string | null;
  interestsCatalog: string[];
  /**
   * PR-05 (SPEC-05 §4): avisar al owner sin credencial activa. No hay
   * lógica de jobs en T2 (fuera de alcance), así que siempre `[]`. La app
   * ignora campos que no conoce, así que añadirlo ahora no rompe nada.
   */
  pendingActions: string[];
  /**
   * Sesiones válidas (`ended` con XP) que el usuario cerró **hoy**, en su
   * propia zona horaria.
   *
   * Home lo necesita para el bono de día doble (SPEC-07 §2: se aplica cuando
   * `sesiones_validas_hoy == 1`) y para su checklist. Antes lo deducía
   * pidiendo `GET /sessions?limit=20` y filtrando en el cliente: veinte filas
   * completas para contar hasta dos, en cada arranque.
   */
  sessionsToday: number;
  /**
   * Obsoleto: siempre `false` desde que no hay credenciales de usuario (F2).
   * Se elimina con la sesión de cortesía en F5.
   */
  courtesySessionAvailable: boolean;
}

/**
 * Respuesta de `PUT /me/profile`. Es el `ProfileDto` de siempre más
 * `xpAwarded` (MEJ-14): cuántos XP se concedieron en **esta** llamada, 0 si
 * el perfil ya estaba completo.
 *
 * Campo añadido al mismo nivel y no dentro de un envoltorio nuevo para no
 * romper a las versiones de la app que parsean `ProfileDto` directamente:
 * ignoran lo que no conocen (mismo criterio que `MeDto.pendingActions`).
 */
export interface UpdateProfileResultDto extends ProfileDto {
  xpAwarded: number;
}

/** Elemento de `members[]` en `GET /group` (RF-6.5, SPEC-07 §9). */
export interface GroupMemberDto {
  userId: string;
  displayName: string;
  level: Level;
  xp: number;
  streak: number;
  lastSessionDay: string | null;
  avatarUrl: string | null;
}
