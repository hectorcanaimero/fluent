import { ConfigService } from '@nestjs/config';
import type { Group } from '../db/schema.js';
import { OwnerService } from './owner.service.js';

const OWNER_USER_ID = '9595625c-aea8-4120-accc-ed149d0a84c6';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Los Pibes',
    owner_id: 'group-owner',
    group_streak: 0,
    group_streak_day: null,
    is_default: false,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `ConfigService` mínimo: solo devuelve `OWNER_USER_ID`. */
function makeConfigService(ownerUserId = OWNER_USER_ID): ConfigService {
  return {
    get: (key: string) => (key === 'OWNER_USER_ID' ? ownerUserId : undefined),
  } as unknown as ConfigService;
}

describe('OwnerService (PEND-11)', () => {
  const service = new OwnerService(makeConfigService());

  describe('isOwner', () => {
    it('acepta al `owner_id` del grupo (SPEC-02 §4.1)', () => {
      expect(service.isOwner('group-owner', makeGroup())).toBe(true);
    });

    it('acepta al OWNER_USER_ID del sistema aunque no sea el owner del grupo', () => {
      expect(service.isOwner(OWNER_USER_ID, makeGroup())).toBe(true);
    });

    it('rechaza a cualquier otro miembro', () => {
      expect(service.isOwner('otro-usuario', makeGroup())).toBe(false);
    });

    it('no considera owner a nadie cuando el grupo se quedó sin `owner_id` (PR-01 §1)', () => {
      // `groups.owner_id` es nullable con ON DELETE SET NULL: un `userId`
      // cualquiera nunca debe colarse por comparar contra `null`.
      expect(service.isOwner('otro-usuario', makeGroup({ owner_id: null }))).toBe(
        false,
      );
    });
  });

  describe('isSystemOwner', () => {
    it('solo acepta al OWNER_USER_ID, no al owner de un grupo', () => {
      expect(service.isSystemOwner(OWNER_USER_ID)).toBe(true);
      expect(service.isSystemOwner('group-owner')).toBe(false);
    });
  });
});
