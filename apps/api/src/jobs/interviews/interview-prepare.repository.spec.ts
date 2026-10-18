import type { InsForgeClient } from '@insforge/sdk';
import type { Redis } from 'ioredis';

import {
  InsforgeInterviewPrepareRepository,
  quotePostgrestValue,
  type InterviewPrepareRow,
} from './interview-prepare.repository.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';

interface Call {
  readonly table: string;
  readonly ops: [string, unknown[]][];
}

/**
 * Cliente InsForge falso: cada `from(table)` es una cadena que registra los
 * métodos llamados y, al hacer `await`, devuelve lo que diga `respond`.
 */
function fakeClient(respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: object = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'then') {
            return (resolve: (v: unknown) => void) => resolve({ data: respond(call), error: null });
          }
          return (...args: unknown[]) => {
            call.ops.push([String(prop), args]);
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { calls, client: { database: { from } } as unknown as InsForgeClient };
}

function interview(overrides: Partial<InterviewPrepareRow> = {}): InterviewPrepareRow {
  return {
    id: 'i-1',
    user_id: USER_ID,
    parent_interview_id: 'parent-1',
    type: 'technical',
    offer_text: 'x',
    offer_url: null,
    offer_hash: 'hash-1',
    status: 'preparing',
    created_at: '2026-10-18T02:30:00.000Z',
    ...overrides,
  };
}

describe('quotePostgrestValue', () => {
  it('entrecomilla y escapa comillas y barras', () => {
    expect(quotePostgrestValue('Backend, APIs')).toBe('"Backend, APIs"');
    expect(quotePostgrestValue('Data (ML)')).toBe('"Data (ML)"');
    expect(quotePostgrestValue('a "b" \\c')).toBe('"a \\"b\\" \\\\c"');
  });
});

describe('InsforgeInterviewPrepareRepository.loadPreviousQuestions', () => {
  it.each(['Backend, APIs', 'Data (ML)'])('el área libre %s va entrecomillada en el `.or()`', async (area) => {
    const { calls, client } = fakeClient((call) =>
      call.table === 'interviews' ? { area } : [{ question: 'Q?' }],
    );
    const repository = new InsforgeInterviewPrepareRepository(client, {} as Redis);

    await expect(repository.loadPreviousQuestions(interview(), 50)).resolves.toEqual(['Q?']);

    const or = calls[1]!.ops.find(([op]) => op === 'or');
    expect(or?.[1][0]).toBe(`offer_hash.eq."hash-1",area.eq."${area}"`);
  });
});

describe('InsforgeInterviewPrepareRepository.insertQuestionsAsked', () => {
  it('omite las preguntas ya guardadas para el mismo (user, oferta)', async () => {
    const { calls, client } = fakeClient((call) =>
      call.ops.some(([op]) => op === 'select') ? [{ question: 'Q1' }] : null,
    );
    const repository = new InsforgeInterviewPrepareRepository(client, {} as Redis);

    await repository.insertQuestionsAsked(USER_ID, 'hash-1', 'eng', ['Q1', 'Q2']);

    const insert = calls[1]!.ops.find(([op]) => op === 'insert');
    expect(insert?.[1][0]).toEqual([{ user_id: USER_ID, offer_hash: 'hash-1', area: 'eng', question: 'Q2' }]);
  });

  it('si ya estaban todas, no inserta nada', async () => {
    const { calls, client } = fakeClient(() => [{ question: 'Q1' }]);
    const repository = new InsforgeInterviewPrepareRepository(client, {} as Redis);

    await repository.insertQuestionsAsked(USER_ID, 'hash-1', 'eng', ['Q1']);

    expect(calls).toHaveLength(1);
  });
});

describe('InsforgeInterviewPrepareRepository.refundDailyCap', () => {
  afterEach(() => vi.useRealTimers());

  it('devuelve el cupo del día de creación aunque el fallo llegue pasada la medianoche', async () => {
    // Creada a las 23:30 de Buenos Aires (02:30Z del 18); falla a las 00:10 del 18 local.
    vi.useFakeTimers({ now: new Date('2026-10-18T03:10:00.000Z') });
    const { client } = fakeClient(() => ({ timezone: 'America/Argentina/Buenos_Aires' }));
    const evalSpy = vi.fn(async () => 1);
    const repository = new InsforgeInterviewPrepareRepository(client, { eval: evalSpy } as unknown as Redis);

    await repository.refundDailyCap(USER_ID, '2026-10-18T02:30:00.000Z');

    expect(evalSpy).toHaveBeenCalledWith(expect.any(String), 1, `interviews:day:${USER_ID}:2026-10-17`);
  });
});
