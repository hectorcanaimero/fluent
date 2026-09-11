import type { Group, Profile } from '../db/schema.js';
import { toGroupDto, toGroupMemberDto, toModelPreferenceDto, toProfileDto } from './profile.mapper.js';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'user-1',
    group_id: 'group-1',
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: ['travel', 'movies', 'food'],
    timezone: 'America/Sao_Paulo',
    locale: 'es',
    xp: 120,
    streak: 4,
    longest_streak: 10,
    last_session_day: '2026-09-07',
    grace_used_week: null,
    courtesy_session_used_at: null,
    sessions_count: 5,
    onboarded_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('toProfileDto', () => {
  it('maps snake_case columns to the camelCase contract', () => {
    const dto = toProfileDto(makeProfile());

    expect(dto).toEqual({
      displayName: 'Ana',
      level: 'B1',
      interests: ['travel', 'movies', 'food'],
      timezone: 'America/Sao_Paulo',
      locale: 'es',
      xp: 120,
      streak: 4,
      lastSessionDay: '2026-09-07',
    });
  });

  it('does not leak columns absent from the app contract (group_id, onboarded_at, ...)', () => {
    const dto = toProfileDto(makeProfile()) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('group_id');
    expect(dto).not.toHaveProperty('onboarded_at');
    expect(dto).not.toHaveProperty('user_id');
  });

  it('passes through a null lastSessionDay', () => {
    const dto = toProfileDto(makeProfile({ last_session_day: null }));
    expect(dto.lastSessionDay).toBeNull();
  });
});

describe('toGroupDto', () => {
  it('maps snake_case columns to the camelCase contract', () => {
    const group: Group = {
      id: 'group-1',
      name: 'Los Pibes',
      owner_id: 'owner-1',
      group_streak: 3,
      group_streak_day: '2026-09-07',
      created_at: '2026-08-01T00:00:00.000Z',
    };

    expect(toGroupDto(group)).toEqual({
      id: 'group-1',
      name: 'Los Pibes',
      groupStreak: 3,
    });
  });
});

describe('toGroupMemberDto', () => {
  it('maps only the RF-6.5 columns, nothing else', () => {
    const dto = toGroupMemberDto({
      user_id: 'user-2',
      display_name: 'Beto',
      level: 'A2',
      xp: 30,
      streak: 1,
      last_session_day: null,
    });

    expect(dto).toEqual({
      userId: 'user-2',
      displayName: 'Beto',
      level: 'A2',
      xp: 30,
      streak: 1,
      lastSessionDay: null,
    });
  });
});

describe('toModelPreferenceDto', () => {
  it('returns null when there is no row', () => {
    expect(toModelPreferenceDto(null)).toBeNull();
  });

  it('maps the row to the camelCase contract', () => {
    expect(
      toModelPreferenceDto({
        chatProvider: 'openrouter',
        chatModel: 'some/model',
        briefProvider: 'gemini',
        briefModel: 'gemini-flash',
      }),
    ).toEqual({
      chatProvider: 'openrouter',
      chatModel: 'some/model',
      briefProvider: 'gemini',
      briefModel: 'gemini-flash',
    });
  });
});
