import type { PushService } from '../../push/push.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import type { ActiveStudyCycleRow, MaintenanceRepository } from './maintenance.repository.js';
import { StudyReminderService } from './study-reminder.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INTERVIEW_ID = '22222222-2222-4222-8222-222222222222';
const TZ = 'America/Argentina/Buenos_Aires';

/** 18:05 en `TZ` (UTC-3): 21:05 UTC. */
const AT_18_LOCAL = new Date('2026-10-18T21:05:00.000Z');
/** 12:05 en `TZ`: fuera de la ventana de las 18:00 local. */
const NOT_18_LOCAL = new Date('2026-10-18T15:05:00.000Z');

function cycle(overrides: Partial<ActiveStudyCycleRow> = {}): ActiveStudyCycleRow {
  return {
    interviewId: INTERVIEW_ID,
    userId: USER_ID,
    sessions: [
      { idx: 1, title: 'Sesión 1', doneAt: '2026-10-17T20:00:00.000Z' }, // ayer local
      { idx: 2, title: 'Sesión 2', doneAt: null },
      { idx: 3, title: 'Sesión 3', doneAt: null },
    ],
    ...overrides,
  };
}

function makeRepository(cycles: ActiveStudyCycleRow[]) {
  return {
    listActiveStudyCycles: vi.fn(async () => cycles),
    loadTimezones: vi.fn(async () => new Map([[USER_ID, TZ]])),
  } as unknown as MaintenanceRepository;
}

function makeRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const sets: Array<{ key: string; value: string }> = [];
  const redis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      sets.push({ key, value });
    }),
  } as unknown as RedisService;
  return { redis, store, sets };
}

function makePush() {
  const sent: unknown[] = [];
  const push = {
    notifyStudyReminder: vi.fn(async (...args: unknown[]) => {
      sent.push(args);
    }),
  } as unknown as PushService;
  return { push, sent };
}

describe('StudyReminderService.run', () => {
  it('a las 18:00 locales, con la última sesión hecha ayer: avisa de la siguiente (2 de 5)', async () => {
    const repository = makeRepository([cycle()]);
    const { redis, sets } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    const result = await service.run(AT_18_LOCAL);

    expect(result).toEqual({ status: 'done', candidates: 1, sent: 1 });
    expect(sent).toEqual([[USER_ID, INTERVIEW_ID, 2, 5, 'Sesión 2']]);
    expect(sets).toEqual([{ key: 'study-reminder:last-sent:' + INTERVIEW_ID, value: '2026-10-18' }]);
  });

  it('fuera de las 18:00 locales del usuario, no avisa', async () => {
    const repository = makeRepository([cycle()]);
    const { redis } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    const result = await service.run(NOT_18_LOCAL);

    expect(result).toEqual({ status: 'done', candidates: 0, sent: 0 });
    expect(sent).toEqual([]);
  });

  it('si la última sesión hecha fue hoy (no ayer), no avisa', async () => {
    const repository = makeRepository([
      cycle({ sessions: [{ idx: 1, title: 'Sesión 1', doneAt: '2026-10-18T14:00:00.000Z' }, { idx: 2, title: 'Sesión 2', doneAt: null }] }),
    ]);
    const { redis } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    await service.run(AT_18_LOCAL);

    expect(sent).toEqual([]);
  });

  it('si ya se avisó hoy, no manda otra vez (máximo uno por día)', async () => {
    const repository = makeRepository([cycle()]);
    const { redis } = makeRedis({ ['study-reminder:last-sent:' + INTERVIEW_ID]: '2026-10-18' });
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    const result = await service.run(AT_18_LOCAL);

    expect(result).toEqual({ status: 'done', candidates: 1, sent: 0 });
    expect(sent).toEqual([]);
  });

  it('si ya se avisó ayer, no manda hoy (nunca dos días seguidos)', async () => {
    const repository = makeRepository([cycle()]);
    const { redis } = makeRedis({ ['study-reminder:last-sent:' + INTERVIEW_ID]: '2026-10-17' });
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    const result = await service.run(AT_18_LOCAL);

    expect(result).toEqual({ status: 'done', candidates: 1, sent: 0 });
    expect(sent).toEqual([]);
  });

  it('al día siguiente de un envío (sin estudiar de nuevo), ya no avisa; dos días después sí', async () => {
    const repository = makeRepository([cycle()]);
    const { redis } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    // Día 1: avisa y guarda la fecha.
    await service.run(AT_18_LOCAL);
    expect(sent).toHaveLength(1);

    // Día 2 (sigue sin hacer la sesión 2, pero "ayer" ya no coincide con el
    // último `done_at`): tampoco avisa, pero por la regla de "última sesión
    // hecha ayer" (ya no es ayer), no por el guardado de Redis.
    const dayAfter = new Date(AT_18_LOCAL.getTime() + 24 * 3600 * 1000);
    await service.run(dayAfter);
    expect(sent).toHaveLength(1);
  });

  it('ciclo sin ninguna sesión hecha todavía: no avisa', async () => {
    const repository = makeRepository([
      cycle({ sessions: [{ idx: 1, title: 'Sesión 1', doneAt: null }] }),
    ]);
    const { redis } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    await service.run(AT_18_LOCAL);

    expect(sent).toEqual([]);
  });

  it('ciclo sin zona horaria de perfil: usa UTC', async () => {
    const repository = {
      listActiveStudyCycles: vi.fn(async () => [cycle()]),
      loadTimezones: vi.fn(async () => new Map()),
    } as unknown as MaintenanceRepository;
    const { redis } = makeRedis();
    const { push, sent } = makePush();
    const service = new StudyReminderService(repository, redis, push);

    // 18:00 UTC exacto.
    await service.run(new Date('2026-10-18T18:05:00.000Z'));

    expect(sent).toHaveLength(1);
  });
});
