export type BadgeCategory = 'level' | 'streak' | 'sessions' | 'special';

/** Fila de `badges` (catálogo configurable, migración 20260919200000). */
export interface BadgeRow {
  id: string;
  category: BadgeCategory;
  threshold: number | null;
  sort_order: number;
  image_key: string;
}

/** Fila de `user_badges`. */
export interface UserBadgeRow {
  badge_id: string;
  earned_at: string;
}

/** Datos del perfil que alimentan el progreso de las insignias con meta. */
export interface BadgeProgressSource {
  xp: number;
  streak: number;
  longest_streak: number;
  sessions_count: number;
}

/**
 * Elemento de `GET /me/badges`. Nombres exactos de
 * `apps/mobile/lib/core/api/models.dart::BadgeItem`.
 */
export interface BadgeDto {
  readonly id: string;
  readonly category: BadgeCategory;
  readonly imageUrl: string;
  readonly earnedAt: string | null;
  readonly progressCurrent: number | null;
  readonly progressTarget: number | null;
}
