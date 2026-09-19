import { badgeImageUrl, toBadgeDtos } from './badges.mapper.js';
import type { BadgeRow } from './badges.types.js';

const BASE = 'https://c4jzbm8x.us-east.insforge.app/';

const catalog: BadgeRow[] = [
  { id: 'level_chatterbox', category: 'level', threshold: 500, sort_order: 20, image_key: 'level_chatterbox.png' },
  { id: 'streak_7', category: 'streak', threshold: 7, sort_order: 70, image_key: 'streak_7.png' },
  { id: 'first_session', category: 'sessions', threshold: 1, sort_order: 100, image_key: 'first_session.png' },
  { id: 'boss_won', category: 'special', threshold: null, sort_order: 140, image_key: 'boss_won.png' },
];

describe('badgeImageUrl', () => {
  it('arma la URL pública estable del bucket badges', () => {
    expect(badgeImageUrl(BASE, 'streak_7.png')).toBe(
      'https://c4jzbm8x.us-east.insforge.app/api/storage/buckets/badges/objects/streak_7.png',
    );
  });
});

describe('toBadgeDtos', () => {
  const profile = { xp: 320, streak: 2, longest_streak: 9, sessions_count: 4 };

  it('mantiene el orden del catálogo y marca las ganadas', () => {
    const dtos = toBadgeDtos(
      catalog,
      [{ badge_id: 'first_session', earned_at: '2026-09-12T10:00:00Z' }],
      profile,
      BASE,
    );
    expect(dtos.map((d) => d.id)).toEqual(['level_chatterbox', 'streak_7', 'first_session', 'boss_won']);
    expect(dtos[2]?.earnedAt).toBe('2026-09-12T10:00:00Z');
    expect(dtos[0]?.earnedAt).toBeNull();
  });

  it('el progreso sale del perfil; la racha usa la mejor histórica', () => {
    const [level, streak, sessions, special] = toBadgeDtos(catalog, [], profile, BASE);
    expect([level?.progressCurrent, level?.progressTarget]).toEqual([320, 500]);
    expect([streak?.progressCurrent, streak?.progressTarget]).toEqual([9, 7]);
    expect([sessions?.progressCurrent, sessions?.progressTarget]).toEqual([4, 1]);
    expect([special?.progressCurrent, special?.progressTarget]).toEqual([null, null]);
  });
});
