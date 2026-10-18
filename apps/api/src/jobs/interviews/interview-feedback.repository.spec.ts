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
  it('ordena los turnos por sesión (más vieja primero) y luego por idx, aunque las filas lleguen desordenadas', async () => {
    const { client } = fakeClient((call) => {
      if (call.table === 'sessions') {
        // La entrevista se retomó dos veces: tres sesiones, en orden de apertura.
        return [{ id: 'session-old' }, { id: 'session-mid' }, { id: 'session-new' }];
      }
      // Los turnos llegan sin relación con el orden de sus sesiones.
      return [
        { session_id: 'session-new', idx: 0, role: 'tutor', text: 'Welcome back', question_idx: 3 },
        { session_id: 'session-old', idx: 1, role: 'user', text: 'First answer', question_idx: 1 },
        { session_id: 'session-old', idx: 0, role: 'tutor', text: 'Q1', question_idx: 1 },
        { session_id: 'session-mid', idx: 0, role: 'tutor', text: 'Q2', question_idx: 2 },
      ];
    });
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    const result = await repository.loadSessionData(USER_ID, INTERVIEW_ID);

    expect(result.sessionIds).toEqual(['session-old', 'session-mid', 'session-new']);
    expect(result.transcript.map((line) => line.text)).toEqual([
      'Q1',
      'First answer',
      'Q2',
      'Welcome back',
    ]);
  });

  it('sin sesiones todavía, no consulta turnos', async () => {
    const { calls, client } = fakeClient((call) => (call.table === 'sessions' ? [] : []));
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    const result = await repository.loadSessionData(USER_ID, INTERVIEW_ID);

    expect(result).toEqual({ sessionIds: [], transcript: [] });
    expect(calls).toHaveLength(1);
  });
});

describe('InsforgeInterviewFeedbackRepository.loadEnglishErrors', () => {
  it('sin sesiones, no consulta correcciones', async () => {
    const { calls, client } = fakeClient(() => []);
    const repository = new InsforgeInterviewFeedbackRepository(client, {} as Redis);

    const result = await repository.loadEnglishErrors([]);

    expect(result).toEqual([]);
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
