import type { InsForgeClient } from '@insforge/sdk';
import { MemoryRepository } from './memory.repository.js';

/**
 * Mock mínimo y encadenable del query builder de `@insforge/sdk`
 * (`admin.database.from(table).eq(...).select(...).maybeSingle()`, etc.).
 * Cada método queda registrado en `calls` con sus argumentos, para poder
 * comprobar que un UPDATE/DELETE de un hecho siempre lleva el filtro por
 * `user_id` (crítico: la clave admin no aplica RLS).
 *
 * El builder es directamente `Promise.resolve(finalResult)` con los métodos
 * de encadenado añadidos como propiedades propias: así un `await` sin
 * `.maybeSingle()` (el caso de un `.delete().select()` sin `.single()`, como
 * en `MemoryRepository.deleteFact`) también resuelve con `finalResult`,
 * usando el `then` real de `Promise.prototype` en vez de definir uno propio
 * (evita el aviso `unicorn/no-thenable` de un objeto que "finge" ser una
 * promesa).
 */
function createAdminMock(finalResult: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[]; table: string }[] = [];
  let currentTable = '';

  const builder = Promise.resolve(finalResult) as Promise<{
    data: unknown;
    error: unknown;
  }> &
    Record<string, unknown>;

  const chainMethods = ['eq', 'neq', 'select', 'update', 'delete', 'insert', 'order', 'limit'];
  for (const method of chainMethods) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args, table: currentTable });
      return builder;
    };
  }
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push({ method: 'maybeSingle', args, table: currentTable });
    return Promise.resolve(finalResult);
  };

  const admin = {
    database: {
      from: (table: string) => {
        currentTable = table;
        calls.push({ method: 'from', args: [table], table });
        return builder;
      },
    },
  };

  return { admin: admin as unknown as InsForgeClient, calls };
}

describe('MemoryRepository.updateFact — filtro por user_id (aislamiento entre usuarios)', () => {
  it('filters by both id and user_id before updating, never by id alone', async () => {
    const { admin, calls } = createAdminMock({
      data: { id: 'fact-1', user_id: 'user-1', status: 'confirmed' },
      error: null,
    });
    const repository = new MemoryRepository(admin);

    await repository.updateFact('user-1', 'fact-1', { status: 'confirmed' });

    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['id', 'fact-1'], table: 'facts' });
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'], table: 'facts' });
    expect(calls.some((c) => c.method === 'update' && c.table === 'facts')).toBe(true);
  });

  it("returns null when the row doesn't match (missing fact or another user's fact)", async () => {
    const { admin } = createAdminMock({ data: null, error: null });
    const repository = new MemoryRepository(admin);

    const result = await repository.updateFact('user-B', 'fact-of-user-A', { status: 'dismissed' });

    expect(result).toBeNull();
  });
});

describe('MemoryRepository.deleteFact — filtro por user_id', () => {
  it('filters by both id and user_id before deleting', async () => {
    const { admin, calls } = createAdminMock({ data: [{ id: 'fact-1' }], error: null });
    const repository = new MemoryRepository(admin);

    const deleted = await repository.deleteFact('user-1', 'fact-1');

    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['id', 'fact-1'], table: 'facts' });
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'], table: 'facts' });
    expect(deleted).toBe(true);
  });

  it('returns false when nothing matched (another user\'s fact)', async () => {
    const { admin } = createAdminMock({ data: [], error: null });
    const repository = new MemoryRepository(admin);

    const deleted = await repository.deleteFact('user-B', 'fact-of-user-A');

    expect(deleted).toBe(false);
  });
});

describe('MemoryRepository.listActiveFacts', () => {
  it('filters by user_id and excludes dismissed facts (SPEC-06 §4.5, PEND-45)', async () => {
    const { admin, calls } = createAdminMock({ data: [], error: null });
    const repository = new MemoryRepository(admin);

    await repository.listActiveFacts('user-1');

    expect(calls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'], table: 'facts' });
    expect(calls).toContainEqual({
      method: 'neq',
      args: ['status', 'dismissed'],
      table: 'facts',
    });
  });
});

describe('MemoryRepository.purgeAll — DELETE /memory', () => {
  it('deletes facts, coaching_brief_history and coaching_briefs, all filtered by user_id', async () => {
    const { admin, calls } = createAdminMock({ data: null, error: null });
    const repository = new MemoryRepository(admin);

    await repository.purgeAll('user-1');

    const deletedTables = calls.filter((c) => c.method === 'delete').map((c) => c.table);
    expect(deletedTables.sort()).toEqual(
      ['coaching_brief_history', 'coaching_briefs', 'facts'].sort(),
    );

    for (const table of ['facts', 'coaching_brief_history', 'coaching_briefs']) {
      expect(calls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'], table });
    }

    // Nunca toca `sessions`: "historial" en SPEC-02 §4.4 es el histórico de
    // briefs, no las sesiones (PEND-44).
    expect(deletedTables).not.toContain('sessions');
  });
});

describe('MemoryRepository.addPendingFactIfNew (D6, F12.3.T1)', () => {
  it('crea el hecho pending cuando no hay uno igual todavía', async () => {
    const { admin, calls } = createAdminMock({ data: [], error: null });
    const repository = new MemoryRepository(admin);

    await repository.addPendingFactIfNew(
      'user-1',
      'Se prepara para una entrevista de Backend engineer en Acme',
      null,
    );

    const insertCall = calls.find((c) => c.method === 'insert' && c.table === 'facts');
    expect(insertCall).toBeDefined();
    expect(insertCall?.args[0]).toMatchObject({
      user_id: 'user-1',
      text: 'Se prepara para una entrevista de Backend engineer en Acme',
      status: 'pending',
    });
  });

  it('no duplica un hecho ya existente para la misma oferta, con otra puntuación o mayúsculas', async () => {
    const { admin, calls } = createAdminMock({
      data: [
        {
          id: 'f1',
          user_id: 'user-1',
          text: 'Se prepara para una entrevista de Backend Engineer en Acme!',
          happens_on: null,
          status: 'pending',
          source_session_id: null,
          last_used_at: null,
          use_count: 0,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const repository = new MemoryRepository(admin);

    await repository.addPendingFactIfNew(
      'user-1',
      'Se prepara para una entrevista de backend engineer en acme',
      null,
    );

    expect(calls.some((c) => c.method === 'insert' && c.table === 'facts')).toBe(false);
  });
});

describe('MemoryRepository.addRecurringErrors (D6, F12.3.T1)', () => {
  it('suma errores nuevos sin duplicar los que ya están', async () => {
    const { admin, calls } = createAdminMock({
      data: {
        user_id: 'user-1',
        text: 'Brief existente.',
        level_hint: null,
        recurring_errors: [{ category: 'past_simple', example: 'I go yesterday' }],
        source_session_id: null,
        updated_at: '2026-10-01T00:00:00.000Z',
      },
      error: null,
    });
    const repository = new MemoryRepository(admin);

    await repository.addRecurringErrors('user-1', [
      { category: 'past_simple', example: 'I go yesterday' },
      { category: 'articles', example: 'I have a car' },
    ]);

    const updateCall = calls.find((c) => c.method === 'update' && c.table === 'coaching_briefs');
    expect(updateCall?.args[0]).toEqual({
      recurring_errors: [
        { category: 'past_simple', example: 'I go yesterday' },
        { category: 'articles', example: 'I have a car' },
      ],
    });
  });

  it('se queda con los primeros 5 cuando el total supera el máximo', async () => {
    const existing = Array.from({ length: 4 }, (_unused, i) => ({
      category: 'other',
      example: `existing ${i}`,
    }));
    const { admin, calls } = createAdminMock({
      data: {
        user_id: 'user-1',
        text: 'Brief existente.',
        level_hint: null,
        recurring_errors: existing,
        source_session_id: null,
        updated_at: '2026-10-01T00:00:00.000Z',
      },
      error: null,
    });
    const repository = new MemoryRepository(admin);

    await repository.addRecurringErrors('user-1', [
      { category: 'articles', example: 'new 1' },
      { category: 'word_order', example: 'new 2' },
      { category: 'vocabulary', example: 'new 3' },
    ]);

    const updateCall = calls.find((c) => c.method === 'update' && c.table === 'coaching_briefs');
    const saved = updateCall?.args[0] as { recurring_errors: unknown[] };
    expect(saved.recurring_errors).toHaveLength(5);
    expect(saved.recurring_errors[4]).toEqual({ category: 'articles', example: 'new 1' });
  });

  it('sin brief todavía no escribe nada (no hay texto de brief que ofrecer)', async () => {
    const { admin, calls } = createAdminMock({ data: null, error: null });
    const repository = new MemoryRepository(admin);

    await repository.addRecurringErrors('user-1', [{ category: 'articles', example: 'a car' }]);

    expect(calls.some((c) => c.method === 'update' && c.table === 'coaching_briefs')).toBe(false);
  });
});

describe('MemoryRepository.upsertBriefText', () => {
  it('updates the existing row (only text) when there is already a brief', async () => {
    const { admin, calls } = createAdminMock({
      data: { user_id: 'user-1', text: 'Updated.' },
      error: null,
    });
    const repository = new MemoryRepository(admin);

    const result = await repository.upsertBriefText('user-1', 'Updated.');

    expect(result).toEqual({ user_id: 'user-1', text: 'Updated.' });
    expect(calls.some((c) => c.method === 'update' && c.table === 'coaching_briefs')).toBe(true);
    expect(calls.some((c) => c.method === 'insert')).toBe(false);
    expect(calls).toContainEqual({
      method: 'eq',
      args: ['user_id', 'user-1'],
      table: 'coaching_briefs',
    });
  });
});
