import type { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { I18nService } from '../i18n/i18n.service.js';
import type { Interview, Profile } from '../db/schema.js';
import type { InterviewFeedback, InterviewPlan } from './interviews.types.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { RedisService } from '../redis/redis.service.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';
import type {
  CreateInterviewRow,
  InterviewListRow,
  InterviewsRepository,
  StudyCycleWithSessions,
} from './interviews.repository.js';
import { InterviewsService } from './interviews.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const INTERVIEW_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-03-10T12:00:00Z');
const TZ = 'Europe/Madrid';

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: USER_ID,
    group_id: null,
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: ['tech'],
    timezone: TZ,
    locale: 'es',
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    courtesy_session_used_at: null,
    plan: 'free',
    plan_expires_at: null,
    sessions_count: 0,
    avatar_url: null,
    onboarded_at: '2026-09-01T10:00:00.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function planFixture(): InterviewPlan {
  return {
    type: 'mixed',
    company: { name: 'Acme', industry: 'retail' },
    role: 'Backend engineer',
    area: 'engineering',
    seniority: 'semi_senior',
    stack: ['node', 'postgres'],
    rubric: [
      { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c2', name: 'Bases de datos', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c3', name: 'Testing', expectedLevel: 'semi_senior', weight: 1 },
      { id: 'c4', name: 'Comunicación', expectedLevel: 'semi_senior', weight: 1 },
    ],
    questions: Array.from({ length: 8 }, (_unusedIdx, idx) => ({
      idx: idx + 1,
      competencyId: `c${(idx % 4) + 1}`,
      kind: idx < 2 ? ('behavioral' as const) : ('technical' as const),
      text: `secret question text ${idx + 1} that must never leak`,
    })),
  };
}

function feedbackFixture(overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    summary: 'Buen manejo de APIs, a reforzar testing.',
    competencies: [],
    english: { clarity: { rating: 'good', note: 'Clara' }, vocabulary: { rating: 'good', note: 'Variado' }, errors: [] },
    comparison: null,
    studyPlan: Array.from({ length: 5 }, (_unused, i) => ({
      idx: i + 1,
      focus: 'c1',
      title: `Sesión ${i + 1}`,
      format: 'guided' as const,
      estMin: 20,
      brief: 'Brief',
    })),
    usage: { model: 'fluent-pro', inputTokens: 10, outputTokens: 10, searchCalls: 0 },
    ...overrides,
  };
}

function interviewFixture(overrides: Partial<Interview> = {}): Interview {
  return {
    id: INTERVIEW_ID,
    user_id: USER_ID,
    parent_interview_id: null,
    type: 'mixed',
    offer_text: 'We are hiring a backend engineer',
    offer_url: null,
    offer_hash: 'hash',
    status: 'preparing',
    prep_step: 'reading',
    company: null,
    role: null,
    area: null,
    seniority: null,
    plan: null,
    feedback: null,
    error_code: null,
    answered_count: 0,
    resumable: true,
    created_at: '2026-03-10T09:00:00.000Z',
    updated_at: '2026-03-10T09:00:00.000Z',
    ...overrides,
  };
}

function fakeConfig(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values: Record<string, unknown> = {
    INTERVIEW_AGENT_URL: 'https://interview-agent.internal',
    INTERVIEWS_DAILY_CAP: 3,
    INTERVIEWS_REQUIRE_PRO: false,
    INTERVIEW_MAX_SEC: 600,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>;
}

function fakeRedis(): RedisService & { readonly counters: Map<string, number> } {
  const counters = new Map<string, number>();
  const locks = new Set<string>();
  return {
    counters,
    setIfAbsent: async (key: string) => {
      if (locks.has(key)) return false;
      locks.add(key);
      return true;
    },
    del: async (key: string) => locks.delete(key),
    increment: async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    get: async (key: string) => {
      const value = counters.get(key);
      return value === undefined ? null : String(value);
    },
    decrementIfPositive: async (key: string) => {
      const next = Math.max(0, (counters.get(key) ?? 0) - 1);
      counters.set(key, next);
      return next;
    },
  } as unknown as RedisService & { readonly counters: Map<string, number> };
}

function fakeJobs(
  fail = false,
): JobDispatcher & {
  readonly enqueued: string[];
  readonly enqueuedFeedback: string[];
  readonly enqueuedOptions: Array<{ interviewId: string; options?: Record<string, unknown> }>;
} {
  const enqueued: string[] = [];
  const enqueuedFeedback: string[] = [];
  const enqueuedOptions: Array<{ interviewId: string; options?: Record<string, unknown> }> = [];
  return {
    enqueued,
    enqueuedFeedback,
    enqueuedOptions,
    enqueueCoachingBrief: async () => {},
    enqueueInterviewPrepare: async (interviewId: string, options?: Record<string, unknown>) => {
      if (fail) throw new Error('Redis caído');
      enqueued.push(interviewId);
      enqueuedOptions.push({ interviewId, options });
    },
    enqueueInterviewFeedback: async (interviewId: string) => {
      if (fail) throw new Error('Redis caído');
      enqueuedFeedback.push(interviewId);
    },
  } as unknown as JobDispatcher & {
    readonly enqueued: string[];
    readonly enqueuedFeedback: string[];
    readonly enqueuedOptions: Array<{ interviewId: string; options?: Record<string, unknown> }>;
  };
}

function fakeProfiles(profile: Profile | null): ProfilesRepository {
  return { findByUserId: async () => profile } as unknown as ProfilesRepository;
}

interface FakeRepoOptions {
  readonly findByIdResult?: Interview | null;
  readonly findCycleResult?: StudyCycleWithSessions | null;
  readonly createFails?: boolean;
  readonly listRows?: InterviewListRow[];
}

function fakeRepository(options: FakeRepoOptions = {}) {
  const created: CreateInterviewRow[] = [];
  const markRetryingCalls: Array<{ userId: string; id: string }> = [];
  const markPrepFailedCalls: Array<{ id: string; errorCode: string }> = [];
  const markFeedbackRetryingCalls: Array<{ userId: string; id: string }> = [];
  const markFeedbackFailedCalls: Array<{ id: string; errorCode: string }> = [];
  const findByIdCalls: string[] = [];
  const rows: Interview[] = [];
  const repository = {
    create: async (row: CreateInterviewRow) => {
      if (options.createFails) throw new Error('InsForge caído');
      created.push(row);
      const interview = interviewFixture({
        type: row.type,
        offer_text: row.offerText,
        offer_url: row.offerUrl,
        offer_hash: row.offerHash,
        parent_interview_id: row.parentInterviewId ?? null,
      });
      rows.push(interview);
      return interview;
    },
    findActiveChild: async (_userId: string, parentId: string) =>
      rows.findLast((row) => row.parent_interview_id === parentId && row.status === 'preparing') ?? null,
    findById: async (_userId: string, id: string) => {
      findByIdCalls.push(id);
      return options.findByIdResult === undefined ? null : options.findByIdResult;
    },
    findCycle: async (_userId: string, _interviewId: string) =>
      options.findCycleResult === undefined ? null : options.findCycleResult,
    listByUser: async () => options.listRows ?? [],
    listCycleProgress: async (_userId: string, ids: readonly string[]) =>
      new Map(ids.filter((id) => id === 'with-cycle').map((id) => [id, { status: 'active', doneCount: 2 }])),
    markRetrying: async (userId: string, id: string) => {
      markRetryingCalls.push({ userId, id });
      if (options.findByIdResult?.status !== 'prep_failed') return null;
      return { ...options.findByIdResult, status: 'preparing', prep_step: 'reading', error_code: null } as Interview;
    },
    markPrepFailed: async (_userId: string, id: string, errorCode: string) => {
      markPrepFailedCalls.push({ id, errorCode });
    },
    markFeedbackRetrying: async (userId: string, id: string) => {
      markFeedbackRetryingCalls.push({ userId, id });
      if (options.findByIdResult?.status !== 'feedback_failed') return null;
      return { ...options.findByIdResult, status: 'feedback_pending', error_code: null } as Interview;
    },
    markFeedbackFailed: async (_userId: string, id: string, errorCode: string) => {
      markFeedbackFailedCalls.push({ id, errorCode });
    },
  };
  return {
    repository: repository as unknown as InterviewsRepository,
    created,
    markRetryingCalls,
    markPrepFailedCalls,
    markFeedbackRetryingCalls,
    markFeedbackFailedCalls,
    findByIdCalls,
  };
}

function buildService(options: {
  readonly config?: Partial<Env>;
  readonly profile?: Profile | null;
  readonly repoOptions?: FakeRepoOptions;
  readonly enqueueFails?: boolean;
}) {
  const redis = fakeRedis();
  const jobs = fakeJobs(options.enqueueFails);
  const { repository, created, markPrepFailedCalls, markFeedbackRetryingCalls, markFeedbackFailedCalls, findByIdCalls } =
    fakeRepository(options.repoOptions);
  const service = new InterviewsService(
    repository,
    fakeProfiles(options.profile === undefined ? profileFixture() : options.profile),
    redis,
    jobs,
    fakeConfig(options.config),
    new I18nService(),
  );
  return {
    service,
    redis,
    jobs,
    created,
    markPrepFailedCalls,
    markFeedbackRetryingCalls,
    markFeedbackFailedCalls,
    findByIdCalls,
  };
}

const TEXT_DTO: CreateInterviewDto = { type: 'mixed', offerText: 'We are hiring a backend engineer' };

describe('InterviewsService.create', () => {
  it('con una oferta de LinkedIn responde 422 OFFER_UNREADABLE sin consumir el tope', async () => {
    const { service, redis, jobs } = buildService({});

    const dto: CreateInterviewDto = { type: 'mixed', offerUrl: 'https://www.linkedin.com/jobs/123' };
    const error = await service.create(USER_ID, dto, undefined, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('OFFER_UNREADABLE');
    expect((error as ApiException).getStatus()).toBe(422);
    expect(redis.counters.size).toBe(0);
    expect(jobs.enqueued).toEqual([]);
  });

  it('detecta también el dominio corto lnkd.in', async () => {
    const { service } = buildService({});
    const dto: CreateInterviewDto = { type: 'mixed', offerUrl: 'https://lnkd.in/abc123' };
    const error = await service.create(USER_ID, dto, undefined, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).code).toBe('OFFER_UNREADABLE');
  });

  it('al pasarse del tope diario responde 429 INTERVIEWS_DAILY_CAP con retryAfter', async () => {
    const { service } = buildService({ config: { INTERVIEWS_DAILY_CAP: 1 } });

    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('INTERVIEWS_DAILY_CAP');
    expect((error as ApiException).getStatus()).toBe(429);
    const body = (error as ApiException).getApiBody();
    expect(typeof body.retryAfter).toBe('number');
  });

  it('sin INTERVIEW_AGENT_URL responde 503', async () => {
    const { service } = buildService({ config: { INTERVIEW_AGENT_URL: undefined } });

    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('INTERVIEW_AGENT_UNAVAILABLE');
    expect((error as ApiException).getStatus()).toBe(503);
  });

  it('con INTERVIEWS_REQUIRE_PRO y plan free responde 403 PLAN_REQUIRED', async () => {
    const { service } = buildService({
      config: { INTERVIEWS_REQUIRE_PRO: true },
      profile: profileFixture({ plan: 'free' }),
    });

    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('PLAN_REQUIRED');
    expect((error as ApiException).getStatus()).toBe(403);
  });

  it('exige exactamente uno de offerText/offerUrl', async () => {
    const { service } = buildService({});

    const bothError = await service
      .create(USER_ID, { type: 'mixed', offerText: 'x', offerUrl: 'https://example.com' }, undefined, NOW)
      .catch((caught: unknown) => caught);
    const neitherError = await service.create(USER_ID, { type: 'mixed' }, undefined, NOW).catch((caught: unknown) => caught);

    expect((bothError as ApiException).code).toBe('VALIDATION');
    expect((neitherError as ApiException).code).toBe('VALIDATION');
  });

  it('con una oferta válida inserta, encola y devuelve la entrevista en preparing', async () => {
    const { service, jobs } = buildService({});

    const result = await service.create(USER_ID, TEXT_DTO, undefined, NOW);

    expect(result.status).toBe('preparing');
    expect(result.prepStep).toBe('reading');
    expect(jobs.enqueued).toEqual([result.id]);
  });
});

describe('InterviewsService.create (fallos y reglas)', () => {
  it('detecta LinkedIn aunque el host lleve punto final', async () => {
    const { service, redis } = buildService({});
    const dto: CreateInterviewDto = { type: 'mixed', offerUrl: 'https://www.linkedin.com./jobs/view/123' };
    const error = await service.create(USER_ID, dto, undefined, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).code).toBe('OFFER_UNREADABLE');
    expect((error as ApiException).getStatus()).toBe(422);
    expect(redis.counters.size).toBe(0);
  });

  it('sin perfil onboarded responde 409 NOT_ONBOARDED sin consumir el tope', async () => {
    const { service, redis } = buildService({ profile: profileFixture({ onboarded_at: null }) });
    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).code).toBe('NOT_ONBOARDED');
    expect((error as ApiException).getStatus()).toBe(409);
    expect(redis.counters.size).toBe(0);
  });

  it('si falla la inserción devuelve el cupo', async () => {
    const { service, redis, markPrepFailedCalls } = buildService({ repoOptions: { createFails: true } });
    await expect(service.create(USER_ID, TEXT_DTO, undefined, NOW)).rejects.toThrow('InsForge caído');
    expect([...redis.counters.values()]).toEqual([0]);
    expect(markPrepFailedCalls).toEqual([]);
  });

  it('si falla el encolado devuelve el cupo y deja la fila en prep_failed (enqueue_failed)', async () => {
    const { service, redis, markPrepFailedCalls } = buildService({ enqueueFails: true });
    await expect(service.create(USER_ID, TEXT_DTO, undefined, NOW)).rejects.toThrow('Redis caído');
    expect([...redis.counters.values()]).toEqual([0]);
    expect(markPrepFailedCalls).toEqual([{ id: INTERVIEW_ID, errorCode: 'enqueue_failed' }]);
  });

  it('con INTERVIEWS_DAILY_CAP=0 no hay tope', async () => {
    const { service, redis } = buildService({ config: { INTERVIEWS_DAILY_CAP: 0 } });
    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    expect(redis.counters.size).toBe(0);
    expect(await service.getQuota(USER_ID, NOW)).toEqual({
      remaining: null,
      limit: 0,
      requiresPro: false,
      freeNotice: true,
    });
  });

  it('traduce el mensaje al pt-BR del perfil', async () => {
    const { service } = buildService({
      config: { INTERVIEWS_DAILY_CAP: 1 },
      profile: profileFixture({ locale: 'pt-BR' }),
    });
    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).getApiBody().message).toBe(
      'Hoje você já usou suas entrevistas. Amanhã tem mais.',
    );
  });

  it('en es usa tuteo', async () => {
    const { service } = buildService({ config: { INTERVIEWS_DAILY_CAP: 1 } });
    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    const error = await service.create(USER_ID, TEXT_DTO, undefined, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).getApiBody().message).toBe(
      'Hoy ya usaste tus entrevistas. Mañana tienes más.',
    );
  });
});

describe('InterviewsService con un :id que no es UUID', () => {
  it('detail y retry responden 404 sin consultar la base', async () => {
    const { service, findByIdCalls } = buildService({});
    const detailError = await service.detail(USER_ID, 'no-es-uuid').catch((caught: unknown) => caught);
    const retryError = await service.retry(USER_ID, 'no-es-uuid').catch((caught: unknown) => caught);
    expect((detailError as ApiException).code).toBe('NOT_FOUND');
    expect((retryError as ApiException).code).toBe('NOT_FOUND');
    expect(findByIdCalls).toEqual([]);
  });
});

describe('InterviewsService.detail', () => {
  it('no incluye las preguntas del plan (FR-7)', async () => {
    const plan = planFixture();
    const interview = interviewFixture({
      status: 'ready',
      prep_step: 'done',
      company: plan.company,
      role: plan.role,
      area: plan.area,
      seniority: plan.seniority,
      plan,
    });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const detail = await service.detail(USER_ID, INTERVIEW_ID);

    expect(detail).not.toHaveProperty('questions');
    expect(detail.questionCount).toBe(8);
    expect(detail.competencies).toEqual([
      { id: 'c1', name: 'APIs' },
      { id: 'c2', name: 'Bases de datos' },
      { id: 'c3', name: 'Testing' },
      { id: 'c4', name: 'Comunicación' },
    ]);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('secret question text');
  });

  it('expone resumable: un too_short cerrado por tiempo no se puede retomar (D5)', async () => {
    const interview = interviewFixture({ status: 'too_short', resumable: false });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const detail = await service.detail(USER_ID, INTERVIEW_ID);

    expect(detail).toMatchObject({ status: 'too_short', resumable: false });
  });

  it('con una entrevista de otro usuario responde 404', async () => {
    // El repositorio filtra por user_id; simular "no encontrada" devolviendo null.
    const { service } = buildService({ repoOptions: { findByIdResult: null } });

    const error = await service.detail(OTHER_USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('NOT_FOUND');
    expect((error as ApiException).getStatus()).toBe(404);
  });
});

describe('InterviewsService.list', () => {
  it('cada item trae resumable, isReinterview y el progreso del ciclo (F13.1.T1)', async () => {
    const base = {
      type: 'mixed',
      status: 'feedback_ready',
      prep_step: null,
      created_at: '2026-10-17T10:00:00Z',
      company: null,
      role: null,
      answered_count: 5,
    } as const;
    const { service } = buildService({
      repoOptions: {
        listRows: [
          { ...base, id: 'with-cycle', parent_interview_id: null, resumable: false },
          { ...base, id: 'no-cycle', status: 'too_short', parent_interview_id: 'p', resumable: true },
        ],
      },
    });

    const { items } = await service.list(USER_ID);

    expect(items[0]).toMatchObject({
      resumable: false,
      isReinterview: false,
      cycleCompletedSessions: 2,
      cycleStatus: 'active',
    });
    expect(items[1]).toMatchObject({
      resumable: true,
      isReinterview: true,
      cycleCompletedSessions: null,
      cycleStatus: null,
    });
  });
});

describe('InterviewsService.retry', () => {
  it('reencola sin consumir el tope diario', async () => {
    const interview = interviewFixture({ status: 'prep_failed', prep_step: null, error_code: 'offer_unreadable' });
    const { service, redis, jobs } = buildService({ repoOptions: { findByIdResult: interview } });

    const result = await service.retry(USER_ID, INTERVIEW_ID);

    expect(result.status).toBe('preparing');
    expect(jobs.enqueued).toEqual([INTERVIEW_ID]);
    expect(redis.counters.size).toBe(0);
  });

  it('solo se puede reintentar desde prep_failed', async () => {
    const interview = interviewFixture({ status: 'ready' });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const error = await service.retry(USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('INTERVIEW_NOT_RETRYABLE');
    expect((error as ApiException).getStatus()).toBe(409);
  });

  it('con una entrevista de otro usuario responde 404', async () => {
    const { service } = buildService({ repoOptions: { findByIdResult: null } });

    const error = await service.retry(OTHER_USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_FOUND');
  });

  it('desde feedback_failed reencola el parecer (F12.3.T1), sin consumir tope', async () => {
    const interview = interviewFixture({ status: 'feedback_failed', error_code: 'agent_unavailable' });
    const { service, redis, jobs } = buildService({ repoOptions: { findByIdResult: interview } });

    const result = await service.retry(USER_ID, INTERVIEW_ID);

    expect(result.status).toBe('feedback_pending');
    expect(jobs.enqueuedFeedback).toEqual([INTERVIEW_ID]);
    expect(jobs.enqueued).toEqual([]);
    expect(redis.counters.size).toBe(0);
  });

  it('si falla el encolado del reintento del parecer, deja la fila en feedback_failed', async () => {
    const interview = interviewFixture({ status: 'feedback_failed' });
    const { service, markFeedbackFailedCalls } = buildService({
      repoOptions: { findByIdResult: interview },
      enqueueFails: true,
    });

    await expect(service.retry(USER_ID, INTERVIEW_ID)).rejects.toThrow('Redis caído');
    expect(markFeedbackFailedCalls).toEqual([{ id: INTERVIEW_ID, errorCode: 'enqueue_failed' }]);
  });
});

describe('InterviewsService.feedback', () => {
  it('feedback_ready → 200 con el parecer, sin `usage` (telemetría interna del agente)', async () => {
    const feedback = feedbackFixture();
    const interview = interviewFixture({ status: 'feedback_ready', feedback });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const result = await service.feedback(USER_ID, INTERVIEW_ID);

    expect(result.statusCode).toBe(200);
    expect(result.body).not.toHaveProperty('usage');
    expect(result.body).toMatchObject({ summary: feedback.summary });
  });

  it('feedback_pending → 202 con el estado', async () => {
    const interview = interviewFixture({ status: 'feedback_pending' });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const result = await service.feedback(USER_ID, INTERVIEW_ID);

    expect(result).toEqual({ statusCode: 202, body: { status: 'feedback_pending' } });
  });

  it('too_short → 409 TOO_SHORT con answeredCount y resumable', async () => {
    const interview = interviewFixture({ status: 'too_short', answered_count: 2, resumable: false });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const error = await service.feedback(USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('TOO_SHORT');
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).getApiBody()).toMatchObject({ answeredCount: 2, resumable: false });
  });

  it('feedback_failed → 503 LLM_UNAVAILABLE (ofrecer reintentar)', async () => {
    const interview = interviewFixture({ status: 'feedback_failed' });
    const { service } = buildService({ repoOptions: { findByIdResult: interview } });

    const error = await service.feedback(USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('LLM_UNAVAILABLE');
    expect((error as ApiException).getStatus()).toBe(503);
  });

  it('con un :id que no es UUID responde 404 sin consultar la base', async () => {
    const { service, findByIdCalls } = buildService({});

    const error = await service.feedback(USER_ID, 'no-es-uuid').catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_FOUND');
    expect(findByIdCalls).toEqual([]);
  });

  it('con una entrevista de otro usuario responde 404', async () => {
    const { service } = buildService({ repoOptions: { findByIdResult: null } });

    const error = await service.feedback(OTHER_USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_FOUND');
  });
});

describe('InterviewsService.getQuota', () => {
  it('descuenta lo ya usado hoy', async () => {
    const { service } = buildService({ config: { INTERVIEWS_DAILY_CAP: 3 } });

    await service.create(USER_ID, TEXT_DTO, undefined, NOW);
    const quota = await service.getQuota(USER_ID, NOW);

    expect(quota).toEqual({ remaining: 2, limit: 3, requiresPro: false, freeNotice: true });
  });
});

function cycleFixture(status: 'active' | 'completed' | 'skipped'): StudyCycleWithSessions {
  return {
    cycle: { id: 'cycle-1', user_id: USER_ID, interview_id: INTERVIEW_ID, status, created_at: NOW.toISOString() },
    sessions: [],
  };
}

describe('InterviewsService.reinterview', () => {
  it('sin ciclo de estudio responde 409 REINTERVIEW_NOT_AVAILABLE sin consumir el tope', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, jobs, redis } = buildService({
      repoOptions: { findByIdResult: parent, findCycleResult: null },
    });

    const error = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('REINTERVIEW_NOT_AVAILABLE');
    expect((error as ApiException).getStatus()).toBe(409);
    expect(jobs.enqueued).toEqual([]);
    expect(redis.counters.size).toBe(0);
  });

  it('con el ciclo todavía active (no completo) responde 409 REINTERVIEW_NOT_AVAILABLE', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, jobs } = buildService({
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('active') },
    });

    const error = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('REINTERVIEW_NOT_AVAILABLE');
    expect(jobs.enqueued).toEqual([]);
  });

  it('con una entrevista que no existe (o es de otro usuario) responde 404 sin consultar el ciclo', async () => {
    const { service } = buildService({ repoOptions: { findByIdResult: null } });

    const error = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_FOUND');
  });

  it('con el ciclo completed crea la entrevista hija en preparing (201), con la misma oferta/tipo y parentInterviewId', async () => {
    const parent = interviewFixture({
      status: 'feedback_ready',
      type: 'mixed',
      offer_text: 'We are hiring a backend engineer',
      offer_url: null,
      offer_hash: 'hash',
      plan: planFixture(),
      feedback: feedbackFixture(),
    });
    const { service, jobs, created, redis } = buildService({
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('completed') },
    });

    const { statusCode, body } = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW);

    expect(statusCode).toBe(201);
    expect(body.status).toBe('preparing');
    expect(body.prepStep).toBe('reading');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      userId: USER_ID,
      type: 'mixed',
      offerText: 'We are hiring a backend engineer',
      offerUrl: null,
      offerHash: 'hash',
      parentInterviewId: INTERVIEW_ID,
    });
    // La rúbrica la busca el job desde la padre: no viaja en la carga.
    expect(jobs.enqueuedOptions).toEqual([{ interviewId: body.id, options: undefined }]);
    // Consume el tope diario como `create` (un contador incrementado).
    expect([...redis.counters.values()]).toEqual([1]);
  });

  it('doble POST: devuelve la misma hija (200) y consume el tope una sola vez', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, jobs, created, redis } = buildService({
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('completed') },
    });

    const [first, second] = await Promise.all([
      service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW),
      service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 201]);
    expect(second.body).toEqual(first.body);
    expect(created).toHaveLength(1);
    expect(jobs.enqueued).toHaveLength(1);
    expect([...redis.counters.values()]).toEqual([1]);
  });

  it('sin onboarding responde NOT_ONBOARDED sin consumir el tope', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, created, redis } = buildService({
      profile: profileFixture({ onboarded_at: null }),
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('completed') },
    });

    const error = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_ONBOARDED');
    expect(created).toEqual([]);
    expect(redis.counters.size).toBe(0);
  });

  it('con INTERVIEWS_REQUIRE_PRO y plan free responde PLAN_REQUIRED sin consumir el tope', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, created, redis } = buildService({
      config: { INTERVIEWS_REQUIRE_PRO: true },
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('completed') },
    });

    const error = await service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW).catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('PLAN_REQUIRED');
    expect(created).toEqual([]);
    expect(redis.counters.size).toBe(0);
  });

  it('con un :id que no es UUID responde 404 sin consultar la base', async () => {
    const { service, findByIdCalls } = buildService({});

    const error = await service.reinterview(USER_ID, 'no-es-uuid').catch((caught: unknown) => caught);

    expect((error as ApiException).code).toBe('NOT_FOUND');
    expect(findByIdCalls).toEqual([]);
  });

  it('si falla el encolado devuelve el cupo y deja la hija en prep_failed (enqueue_failed)', async () => {
    const parent = interviewFixture({ status: 'feedback_ready', plan: planFixture(), feedback: feedbackFixture() });
    const { service, redis, markPrepFailedCalls } = buildService({
      repoOptions: { findByIdResult: parent, findCycleResult: cycleFixture('completed') },
      enqueueFails: true,
    });

    await expect(service.reinterview(USER_ID, INTERVIEW_ID, undefined, NOW)).rejects.toThrow('Redis caído');

    expect([...redis.counters.values()]).toEqual([0]);
    expect(markPrepFailedCalls).toEqual([{ id: INTERVIEW_ID, errorCode: 'enqueue_failed' }]);
  });
});
