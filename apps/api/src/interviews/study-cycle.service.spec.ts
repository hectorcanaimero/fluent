import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ApiException } from '../common/api-error.js';
import type { Profile, StudyCycleSession } from '../db/schema.js';
import type { I18nService } from '../i18n/i18n.service.js';
import type { LlmService } from '../llm/llm.service.js';
import { buildTurnSystemPrompt } from '../llm/prompts/turn.js';
import type { LlmMessage } from '../llm/types.js';
import { rebuildScenario } from '../sessions/scenario.js';
import { SessionCloserService } from '../sessions/session-closer.service.js';
import type { SessionsRepository } from '../sessions/sessions.repository.js';
import { InterviewsRepository } from './interviews.repository.js';
import type { StudyPlanItem } from './interviews.types.js';
import { StudyCycleService } from './study-cycle.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INTERVIEW_ID = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, unknown>;

/** Defaults de columna que el código lee como `null` (no `undefined`). */
const DEFAULTS: Record<string, Row> = {
  study_cycle_sessions: { done_at: null },
  sessions: { study_cycle_session_id: null, status: 'active', turns_count: 0 },
};

/**
 * Base en memoria con el subconjunto de PostgREST que usa el ciclo: `upsert`
 * con `ignoreDuplicates` respeta el UNIQUE de `onConflict` como Postgres.
 */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ??= []);
      let op: 'select' | 'insert' | 'upsert' | 'update' = 'select';
      let input: Row[] = [];
      let conflict: string[] = [];
      let patch: Row = {};
      let single = false;
      let orderBy: string | null = null;
      const filters: [string, unknown][] = [];
      const matches = (row: Row) => filters.every(([col, value]) => row[col] === value);
      const run = () => {
        let data: Row[];
        if (op === 'insert' || op === 'upsert') {
          data = [];
          for (const value of input) {
            const dup =
              op === 'upsert' && rows.some((row) => conflict.every((col) => row[col] === value[col]));
            if (dup) continue;
            const created = { id: randomUUID(), ...DEFAULTS[table], ...value };
            rows.push(created);
            data.push(created);
          }
        } else if (op === 'update') {
          data = rows.filter(matches);
          for (const row of data) Object.assign(row, patch);
        } else {
          data = rows.filter(matches);
          if (orderBy !== null) {
            const col = orderBy;
            data = [...data].sort((a, b) => Number(a[col]) - Number(b[col]));
          }
        }
        return { data: single ? (data[0] ?? null) : data, error: null };
      };
      const query = {
        select: () => query,
        insert: (value: Row) => ((op = 'insert'), (input = [value]), query),
        upsert: (value: Row | Row[], opts: { onConflict: string }) => (
          (op = 'upsert'),
          (input = Array.isArray(value) ? value : [value]),
          (conflict = opts.onConflict.split(',')),
          query
        ),
        update: (value: Row) => ((op = 'update'), (patch = value), query),
        delete: () => query,
        eq: (col: string, value: unknown) => (filters.push([col, value]), query),
        order: (col: string) => ((orderBy = col), query),
        maybeSingle: () => ((single = true), query),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(run()).then(resolve, reject),
      };
      return query;
    },
  };
}

const PLAN: StudyPlanItem[] = Array.from({ length: 5 }, (_unused, i) => ({
  idx: i + 1,
  focus: i === 4 ? 'english' : `c${i + 1}`,
  title: `Sesión ${i + 1}`,
  format: i % 2 === 0 ? 'guided' : 'roleplay',
  estMin: 10,
  brief: `Practicar el tema ${i + 1}`,
}));

const PROFILE = {
  user_id: USER_ID,
  locale: 'es',
  level: 'B1',
  onboarded_at: '2026-10-01T00:00:00Z',
  plan: 'free',
} as unknown as Profile;

function build(tables: Record<string, Row[]> = {}) {
  const db = fakeDb(tables);
  const repository = new InterviewsRepository({ database: db } as never);
  const prompts: LlmMessage[][] = [];
  const llm = {
    complete: async (request: { messages: LlmMessage[] }) => {
      prompts.push(request.messages);
      return {
        data: { reply: 'Hi! Ready?', corrections: [] },
        modelUsed: 'test-model',
        usage: { tokensIn: 1, tokensOut: 1 },
        attempts: [{ latencyMs: 10 }],
      };
    },
  } as unknown as LlmService;
  const sessions = {
    findProfile: async () => PROFILE,
    findActiveSessionId: async () => null,
    findBriefText: async () => null,
    listConfirmedFacts: async () => [],
    findChatModelPreference: async () => null,
    updateAfterOpening: async () => null,
    insertOpeningTurn: async () => undefined,
    deleteSession: async () => undefined,
  } as unknown as SessionsRepository;
  const i18n = {
    resolveLocale: () => 'es',
    translate: (code: string) => code,
  } as unknown as I18nService;
  const config = { get: () => '1' } as never;
  const service = new StudyCycleService(repository, sessions, llm, config, i18n);
  return { service, repository, tables, db, prompts };
}

function seedInterview(tables: Record<string, Row[]>, status = 'feedback_ready') {
  tables.interviews = [
    { id: INTERVIEW_ID, user_id: USER_ID, status, feedback: { studyPlan: PLAN } },
  ];
}

/** Ciclo con las primeras `done` sesiones hechas. */
async function seedCycle(done: number) {
  const ctx = build();
  seedInterview(ctx.tables);
  await ctx.service.create(USER_ID, INTERVIEW_ID);
  for (const row of ctx.tables.study_cycle_sessions as unknown as StudyCycleSession[]) {
    if (row.idx <= done) row.done_at = '2026-10-17T10:00:00Z';
  }
  return ctx;
}

describe('StudyCycleService.create', () => {
  it('crear el ciclo dos veces deja una sola fila con sus 5 sesiones', async () => {
    const { service, repository, tables } = build();
    seedInterview(tables);

    const first = await service.create(USER_ID, INTERVIEW_ID);
    const second = await service.create(USER_ID, INTERVIEW_ID);
    // También la carrera: el repositorio llamado otra vez no duplica.
    await repository.upsertCycle(USER_ID, INTERVIEW_ID, PLAN);

    expect(tables.study_cycles).toHaveLength(1);
    expect(tables.study_cycle_sessions).toHaveLength(5);
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      status: 'active',
      doneCount: 0,
      totalSessions: 5,
      totalMin: 50,
    });
    expect(first.sessions.map((s) => s.state)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('sin parecer listo → 409 STUDY_CYCLE_NOT_AVAILABLE', async () => {
    const { service, tables } = build();
    seedInterview(tables, 'feedback_pending');

    const error = await service.create(USER_ID, INTERVIEW_ID).catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('STUDY_CYCLE_NOT_AVAILABLE');
    expect((error as ApiException).getApiBody().statusCode).toBe(409);
    expect(tables.study_cycles ?? []).toHaveLength(0);
  });
});

describe('StudyCycleService.get', () => {
  it('estados done / available / locked y "n de 5"', async () => {
    const { service } = await seedCycle(2);

    const cycle = await service.get(USER_ID, INTERVIEW_ID);

    expect(cycle.doneCount).toBe(2);
    expect(cycle.sessions.map((s) => s.state)).toEqual([
      'done',
      'done',
      'available',
      'locked',
      'locked',
    ]);
  });
});

describe('StudyCycleService.start', () => {
  it('arrancar la 3 sin la 2 → 409 STUDY_SESSION_LOCKED sin crear sesión', async () => {
    const { service, tables } = await seedCycle(1);

    const error = await service.start(USER_ID, INTERVIEW_ID, 3).catch((e: unknown) => e);

    expect((error as ApiException).code).toBe('STUDY_SESSION_LOCKED');
    expect((error as ApiException).getApiBody().statusCode).toBe(409);
    expect(tables.sessions ?? []).toHaveLength(0);
  });

  it('crea una sesión `study` con el foco en el prompt', async () => {
    const { service, tables, prompts } = await seedCycle(1);
    const row = (tables.study_cycle_sessions as unknown as StudyCycleSession[]).find(
      (s) => s.idx === 2,
    )!;

    const result = await service.start(USER_ID, INTERVIEW_ID, 2);

    expect(tables.sessions).toEqual([
      expect.objectContaining({
        kind: 'study',
        topic: 'Sesión 2',
        study_cycle_session_id: row.id,
      }),
    ]);
    expect(result.opening.text).toBe('Hi! Ready?');
    expect(prompts[0]?.[0]?.content).toContain(
      'Session type: study. Study session focus: <datos>Sesión 2 (c2)</datos>. ' +
        'What to practice: <datos>Practicar el tema 2</datos>. Roleplay a realistic work situation',
    );
  });
});

describe('prompt de turno de una sesión study', () => {
  it('el turno reconstruye el foco desde la fila del ciclo (snapshot)', () => {
    const row = {
      id: 'x',
      cycle_id: 'c',
      idx: 1,
      focus: 'APIs',
      title: 'Diseño de APIs REST',
      format: 'guided',
      est_min: 10,
      brief: 'Explicar idempotencia y códigos de estado.',
      done_at: null,
    } as const;
    const scenario = rebuildScenario(
      { kind: 'study', topic: row.title, news_item_id: null },
      null,
      row,
    );

    expect(scenario).toMatchObject({ kind: 'study', fallback: false });
    expect(
      buildTurnSystemPrompt({ locale: 'es', level: 'B1', kind: scenario.kind, study: scenario.study })
        .split('\n')
        .find((line) => line.startsWith('Session type:')),
    ).toMatchInlineSnapshot(`"Session type: study. Study session focus: <datos>Diseño de APIs REST (APIs)</datos>. What to practice: <datos>Explicar idempotencia y códigos de estado.</datos>. Guided conversation: steer every question towards this topic and ask the learner to explain, give examples and justify choices."`);
  });

  it('sin fila del ciclo cae a free_topic con el título', () => {
    expect(rebuildScenario({ kind: 'study', topic: 'Tema', news_item_id: null })).toMatchObject({
      kind: 'free_topic',
      fallback: true,
      topic: 'Tema',
    });
  });
});

describe('cierre de sesiones study', () => {
  function closer(db: ReturnType<typeof fakeDb>) {
    const repo = {
      closeSession: async () => ({ xp_earned: 10, streak: 1, is_double_day: false, next_is_boss: false }),
      markBriefDone: async () => undefined,
      awardBadges: async () => [],
    };
    const jobs = { enqueueCoachingBrief: async () => undefined };
    return new SessionCloserService(repo as never, jobs as never, { database: db } as never);
  }

  async function studySessionFor(idx: number, ctx: Awaited<ReturnType<typeof seedCycle>>) {
    const row = (ctx.tables.study_cycle_sessions as unknown as StudyCycleSession[]).find(
      (s) => s.idx === idx,
    )!;
    await ctx.service.start(USER_ID, INTERVIEW_ID, idx);
    const session = ctx.tables.sessions!.find((s) => s.study_cycle_session_id === row.id)!;
    return { row, sessionId: session.id as string };
  }

  it('cerrar la quinta marca done_at y completa el ciclo', async () => {
    const ctx = await seedCycle(4);
    const { row, sessionId } = await studySessionFor(5, ctx);

    await closer(ctx.db).close({ userId: USER_ID, sessionId, durationSec: 300, turnsCount: 4, decideBrief: true });

    expect(row.done_at).not.toBeNull();
    expect(ctx.tables.study_cycles![0]!.status).toBe('completed');
    expect((await ctx.service.get(USER_ID, INTERVIEW_ID)).doneCount).toBe(5);
  });

  it('cerrar una que no es la última no completa el ciclo; sin turnos no cuenta', async () => {
    const ctx = await seedCycle(1);
    const { row, sessionId } = await studySessionFor(2, ctx);

    await closer(ctx.db).close({ userId: USER_ID, sessionId, durationSec: 30, turnsCount: 0, decideBrief: true });
    expect(row.done_at).toBeNull();

    await closer(ctx.db).close({ userId: USER_ID, sessionId, durationSec: 300, turnsCount: 3, decideBrief: false });
    expect(row.done_at).not.toBeNull();
    expect(ctx.tables.study_cycles![0]!.status).toBe('active');
  });
});
