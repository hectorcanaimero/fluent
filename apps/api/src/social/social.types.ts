import type { ChallengeCandidate } from './challenge-picker.js';

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
}

/** Respuesta de `GET /leaderboard` (SPEC-02 §4.5). */
export interface LeaderboardResultDto {
  readonly weekStart: string;
  readonly rows: LeaderboardRowDto[];
  readonly groupStreak: number;
}

/** Elemento de `GET /challenges` (SPEC-02 §4.5, RF-6.4). */
export type ChallengeItemDto = ChallengeCandidate;

/** Respuesta de `GET /challenges`: envuelta en `items` (contrato exacto de la app). */
export interface ChallengesResultDto {
  readonly items: ChallengeItemDto[];
}

/** Respuesta de `GET /weekly-summary` (SPEC-02 §4.5). */
export interface WeeklySummaryResultDto {
  readonly text: string;
  readonly weekStart: string;
}
