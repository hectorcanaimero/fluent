import type { InsForgeClient } from '@insforge/sdk';
import {
  generateInvitationCode,
  GroupsRepository,
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
} from './groups.repository.js';

/** Debe coincidir exactamente con el CHECK de la migración de PR-01. */
const INVITATION_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

describe('generateInvitationCode', () => {
  it('generates codes matching the DB CHECK constraint (^[A-HJ-NP-Z2-9]{8}$)', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateInvitationCode()).toMatch(INVITATION_CODE_PATTERN);
    }
  });

  it('has the expected length and alphabet', () => {
    expect(INVITATION_CODE_LENGTH).toBe(8);
    // Sin 0, O, 1, I (alfabeto sin ambigüedad, pendientes/PR-01 §5).
    expect(INVITATION_CODE_ALPHABET).not.toMatch(/[01OI]/);
  });

  it('does not always generate the same code (basic randomness sanity check)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInvitationCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

/**
 * Doble encadenable del query builder de InsForge: guarda la tabla y los
 * filtros aplicados para poder comprobar **qué** se consultó, que es lo único
 * que este repositorio decide (el resto lo hace Postgres).
 */
function fakeAdmin(rows: unknown[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'gt', 'limit'] as const) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return method === 'limit' ? { data: rows, error: null } : builder;
    };
  }

  const admin = {
    database: {
      from: (table: string) => {
        calls.push(['from', table]);
        return builder;
      },
    },
  } as unknown as InsForgeClient;

  return { admin, calls };
}
