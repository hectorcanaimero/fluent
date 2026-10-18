import type { InsForgeClient } from '@insforge/sdk';

import { findBlockingActiveSessionId } from './active-session.js';

type Row = Record<string, unknown>;

/** Doble mínimo de `admin.database`: filtra `eq`/`in` sobre filas en memoria. */
function fakeAdmin(tables: Record<string, Row[]>): InsForgeClient {
  const from = (table: string) => {
    // Cada paso devuelve una Promise real con el resultado hasta ahí y los
    // métodos del builder para seguir encadenando.
    const chain = (rows: Row[]): unknown =>
      Object.assign(Promise.resolve({ data: rows, error: null }), {
        select: () => chain(rows),
        order: () => chain(rows),
        eq: (col: string, value: unknown) => chain(rows.filter((r) => r[col] === value)),
        in: (col: string, values: unknown[]) =>
          chain(rows.filter((r) => values.includes(r[col]))),
      });
    return chain([...(tables[table] ?? [])]);
  };
  return { database: { from } } as unknown as InsForgeClient;
}

const USER = 'u-1';

describe('findBlockingActiveSessionId (una sola sesión activa, D5)', () => {
  it('una entrevista en pausa (too_short) no bloquea: sin otra sesión, null', async () => {
    const admin = fakeAdmin({
      sessions: [{ id: 's-int', user_id: USER, status: 'active', kind: 'interview', interview_id: 'i-1' }],
      interviews: [{ id: 'i-1', status: 'too_short' }],
    });

    expect(await findBlockingActiveSessionId(admin, USER)).toBeNull();
  });

  it('con una entrevista en pausa y una sesión normal activa, devuelve la normal', async () => {
    const admin = fakeAdmin({
      sessions: [
        { id: 's-int', user_id: USER, status: 'active', kind: 'interview', interview_id: 'i-1' },
        { id: 's-free', user_id: USER, status: 'active', kind: 'free_topic', interview_id: null },
      ],
      interviews: [{ id: 'i-1', status: 'too_short' }],
    });

    expect(await findBlockingActiveSessionId(admin, USER)).toBe('s-free');
  });

  it('una entrevista en curso (in_progress) sí bloquea', async () => {
    const admin = fakeAdmin({
      sessions: [{ id: 's-int', user_id: USER, status: 'active', kind: 'interview', interview_id: 'i-1' }],
      interviews: [{ id: 'i-1', status: 'in_progress' }],
    });

    expect(await findBlockingActiveSessionId(admin, USER)).toBe('s-int');
  });

  it('una sesión normal activa bloquea (abrir o retomar una entrevista da 409)', async () => {
    const admin = fakeAdmin({
      sessions: [{ id: 's-free', user_id: USER, status: 'active', kind: 'roleplay', interview_id: null }],
    });

    expect(await findBlockingActiveSessionId(admin, USER)).toBe('s-free');
  });
});
