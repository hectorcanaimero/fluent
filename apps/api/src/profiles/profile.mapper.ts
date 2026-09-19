import type { Group, Profile } from '../db/schema.js';
import type { GroupDto, GroupMemberDto, ModelPreferenceDto, ProfileDto } from './profiles.types.js';
import type { ModelPreferenceRow } from './profiles.repository.js';

/** Fila de `profiles` (snake_case) → `profile` de la API (camelCase). */
export function toProfileDto(row: Profile): ProfileDto {
  return {
    displayName: row.display_name,
    level: row.level,
    interests: row.interests,
    timezone: row.timezone,
    locale: row.locale,
    xp: row.xp,
    streak: row.streak,
    lastSessionDay: row.last_session_day,
    avatarUrl: row.avatar_url,
  };
}

/** Fila de `groups` (snake_case) → `group` de la API (camelCase). */
export function toGroupDto(row: Group): GroupDto {
  return {
    id: row.id,
    name: row.name,
    groupStreak: row.group_streak,
    isDefault: row.is_default,
  };
}

/** Fila proyectada de `profiles` (vista de miembro) → elemento de `members[]`. */
export function toGroupMemberDto(row: {
  user_id: string;
  display_name: string;
  level: Profile['level'];
  xp: number;
  streak: number;
  last_session_day: string | null;
}): GroupMemberDto {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    level: row.level,
    xp: row.xp,
    streak: row.streak,
    lastSessionDay: row.last_session_day,
  };
}

export function toModelPreferenceDto(row: ModelPreferenceRow | null): ModelPreferenceDto | null {
  if (row === null) {
    return null;
  }
  return {
    chatProvider: row.chatProvider,
    chatModel: row.chatModel,
    briefProvider: row.briefProvider,
    briefModel: row.briefModel,
  };
}
