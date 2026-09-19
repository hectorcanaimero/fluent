import type { SessionKind } from '../db/schema.js';

/**
 * Fila de `GET /leaderboard` (SPEC-02 §4.5). Nombres de campo exactamente
 * como espera `apps/mobile/lib/core/api/models.dart::LeaderboardRow` (no se
 * toca ese archivo).
 */
export interface LeaderboardRowDto {
  readonly userId: string;
  readonly displayName: string;
  readonly xpWeek: number;
  readonly sessionsWeek: number;
  readonly streak: number;
  /** Foto del login social del miembro, o null (la app muestra la inicial). */
  readonly avatarUrl: string | null;
}

/** Respuesta de `GET /leaderboard` (SPEC-02 §4.5). */
export interface LeaderboardResultDto {
  readonly weekStart: string;
  readonly rows: LeaderboardRowDto[];
  readonly groupStreak: number;
}

/**
 * Elemento de `GET /challenges` (SPEC-02 §4.5, RF-6.4).
 *
 * Estos cinco campos, y solo estos: es lo que lista SPEC-02 §4.5 y lo que
 * espera `apps/mobile/lib/core/api/models.dart::ChallengeItem` (no se toca ese
 * archivo). El `ChallengeCandidate` de `src/game/challenges.service.ts` trae
 * además `endedAt`, que sirve para ordenar los candidatos pero no forma parte
 * de la respuesta: lo recorta `ChallengesService` al mapear
 * (docs/specs/pendientes/PR-02.md PEND-71).
 */
export interface ChallengeItemDto {
  readonly fromUserId: string;
  readonly displayName: string;
  readonly topic: string;
  readonly kind: SessionKind;
  readonly sessionId: string;
  /** Foto del miembro que originó el desafío, o null. */
  readonly avatarUrl: string | null;
}

/** Respuesta de `GET /challenges`: envuelta en `items` (contrato exacto de la app). */
export interface ChallengesResultDto {
  readonly items: ChallengeItemDto[];
}

/** Respuesta de `GET /weekly-summary` (SPEC-02 §4.5). */
export interface WeeklySummaryResultDto {
  readonly text: string;
  readonly weekStart: string;
}
