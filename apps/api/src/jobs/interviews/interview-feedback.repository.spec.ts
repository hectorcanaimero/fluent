import type { InsForgeClient } from '@insforge/sdk';
import type { Redis } from 'ioredis';

import { InsforgeInterviewFeedbackRepository } from './interview-feedback.repository.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const INTERVIEW_ID = '11111111-1111-4111-8111-111111111111';

interface Call {
  readonly table: string;
  readonly ops: [string, unknown[]][];
}

/** Mismo doble encadenable que `interview-prepare.repository.spec.ts`. */
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

describe('InsforgeInterviewFeedbackRepository.loadSessionData', () => {
  it('lee la única sesión de la entrevista y sus turnos por session_id en orden de idx', async () => {
    const { calls, client } = fakeClient((call) => {
      if (call.table === 'sessions') return { id: 'session-1' };
      return [
        { role: 'tutor', text: 'Q1', question_idx: 1 },
        { role: 'user', text: 'First answer', question_idx: null },
      ];
    });
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    const result = await repository.loadSessionData(USER_ID, INTERVIEW_ID);

    expect(result.sessionId).toBe('session-1');
    expect(result.transcript.map((line) => line.text)).toEqual(['Q1', 'First answer']);
    expect(calls[1]!.ops).toContainEqual(['eq', ['session_id', 'session-1']]);
    expect(calls[1]!.ops).toContainEqual(['order', ['idx', { ascending: true }]]);
  });

  it('sin sesión todavía, no consulta turnos', async () => {
    const { calls, client } = fakeClient(() => null);
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    const result = await repository.loadSessionData(USER_ID, INTERVIEW_ID);

    expect(result).toEqual({ sessionId: null, transcript: [] });
    expect(calls).toHaveLength(1);
  });
});

describe('InsforgeInterviewFeedbackRepository.loadEnglishErrors', () => {
  it('lee las correcciones de esa sesión', async () => {
    const rows = [{ original: 'I go', corrected: 'I went', category: 'grammar' }];
    const { calls, client } = fakeClient(() => rows);
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    expect(await repository.loadEnglishErrors('session-1')).toEqual(rows);
    expect(calls[0]!.ops).toContainEqual(['eq', ['session_id', 'session-1']]);
  });

  it('sin sesión, no consulta correcciones', async () => {
    const { calls, client } = fakeClient(() => []);
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    expect(await repository.loadEnglishErrors(null)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('InsforgeInterviewFeedbackRepository — candados', () => {
  it('acquireFeedbackLock usa el prefijo `interview:feedback:`', async () => {
    const evalSpy = vi.fn(async () => 1);
    const { client } = fakeClient(() => null);
    const repository = new InsforgeInterviewFeedbackRepository(client, { eval: evalSpy } as unknown as Redis);

    await repository.acquireFeedbackLock(INTERVIEW_ID, 'job-1');

    expect(evalSpy).toHaveBeenCalledWith(
      expect.any(String),
      1,
      `interview:feedback:${INTERVIEW_ID}`,
      'job-1',
      expect.any(Number),
    );
  });
});
