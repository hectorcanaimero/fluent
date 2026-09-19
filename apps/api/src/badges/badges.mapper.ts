import type { BadgeDto, BadgeProgressSource, BadgeRow, UserBadgeRow } from './badges.types.js';

/**
 * URL pública y estable de la imagen: redirige al CDN con `?v=<hash>`, así
 * que reemplazar el archivo en el bucket `badges` con la misma key cambia la
 * imagen sin tocar la app ni este código.
 */
export function badgeImageUrl(insforgeUrl: string, imageKey: string): string {
  const base = insforgeUrl.replace(/\/+$/, '');
  return `${base}/api/storage/buckets/badges/objects/${encodeURIComponent(imageKey)}`;
}

function progressFor(row: BadgeRow, p: BadgeProgressSource | null): number | null {
  if (row.threshold === null || p === null) return null;
  switch (row.category) {
    case 'level':
      return p.xp;
    case 'streak':
      return Math.max(p.streak, p.longest_streak);
    case 'sessions':
      return p.sessions_count;
    default:
      return null;
  }
}

/** Catálogo (ya ordenado) + ganadas + perfil → respuesta de `GET /me/badges`. */
export function toBadgeDtos(
  catalog: readonly BadgeRow[],
  earned: readonly UserBadgeRow[],
  profile: BadgeProgressSource | null,
  insforgeUrl: string,
): BadgeDto[] {
  const earnedAt = new Map(earned.map((e) => [e.badge_id, e.earned_at]));
  return catalog.map((row) => ({
    id: row.id,
    category: row.category,
    imageUrl: badgeImageUrl(insforgeUrl, row.image_key),
    earnedAt: earnedAt.get(row.id) ?? null,
    progressCurrent: progressFor(row, profile),
    progressTarget: row.threshold,
  }));
}
