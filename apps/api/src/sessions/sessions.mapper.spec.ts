import type { Session } from '../db/schema.js';
import { toSessionInfoDto } from './sessions.mapper.js';

function sessionRow(overrides: Partial<Session> = {}): Session {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    kind: 'free_topic',
    topic: 'Viajes',
    news_item_id: null,
    challenge_from_user_id: null,
    status: 'active',
    started_at: '2026-09-08T10:00:00.000Z',
    ended_at: null,
    duration_sec: null,
    turns_count: 0,
    xp_earned: 0,
    chat_model_used: null,
    callback_fact_id: null,
    brief_job_status: 'pending',
    courtesy: false,
    ...overrides,
  };
}

describe('toSessionInfoDto', () => {
  it('mapea una sesión abierta con los nombres exactos de la app', () => {
    expect(toSessionInfoDto(sessionRow())).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'free_topic',
      topic: 'Viajes',
      startedAt: '2026-09-08T10:00:00.000Z',
      endedAt: null,
      xpEarned: 0,
      modelUsed: null,
    });
  });

  it('mapea una sesión cerrada con modelo y XP', () => {
    const dto = toSessionInfoDto(
      sessionRow({
        kind: 'boss',
        status: 'ended',
        ended_at: '2026-09-08T10:10:00.000Z',
        xp_earned: 160,
        chat_model_used: 'fluent-free',
      }),
    );

    expect(dto).toMatchObject({
      kind: 'boss',
      endedAt: '2026-09-08T10:10:00.000Z',
      xpEarned: 160,
      modelUsed: 'fluent-free',
    });
  });

  it('no expone campos internos de la fila', () => {
    const dto = toSessionInfoDto(
      sessionRow({ challenge_from_user_id: 'x', callback_fact_id: 'y', turns_count: 4 }),
    ) as unknown as Record<string, unknown>;

    expect(Object.keys(dto).sort()).toEqual([
      'endedAt',
      'id',
      'kind',
      'modelUsed',
      'startedAt',
      'topic',
      'xpEarned',
    ]);
  });
});
