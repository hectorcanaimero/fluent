import type { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Interview, InterviewPlan, Profile } from '../db/schema.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { ProfilesRepository } from '../profiles/profiles.repository.js';
import type { RedisService } from '../redis/redis.service.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';
import type { CreateInterviewRow, InterviewsRepository } from './interviews.repository.js';
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
  return {
    counters,
    increment: async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    get: async (key: string) => {
      const value = counters.get(key);
      return value === undefined ? null : String(value);
    },
  } as unknown as RedisService & { readonly counters: Map<string, number> };
}

function fakeJobs(): JobDispatcher & { readonly enqueued: string[] } {
  const enqueued: string[] = [];
  return {
    enqueued,
    enqueueCoachingBrief: async () => {},
    enqueueInterviewPrepare: async (interviewId: string) => {
      enqueued.push(interviewId);
    },
  } as unknown as JobDispatcher & { readonly enqueued: string[] };
}

function fakeProfiles(profile: Profile | null): ProfilesRepository {
  return { findByUserId: async () => profile } as unknown as ProfilesRepository;
}

interface FakeRepoOptions {
  readonly findByIdResult?: Interview | null;
}

function fakeRepository(options: FakeRepoOptions = {}) {
  const created: CreateInterviewRow[] = [];
  const markRetryingCalls: Array<{ userId: string; id: string }> = [];
  const repository = {
    create: async (row: CreateInterviewRow) => {
      created.push(row);
      return interviewFixture({
        type: row.type,
        offer_text: row.offerText,
        offer_url: row.offerUrl,
        offer_hash: row.offerHash,
      });
    },
    findById: async () =>
      options.findByIdResult === undefined ? null : options.findByIdResult,
    listByUser: async () => [],
    markRetrying: async (userId: string, id: string) => {
      markRetryingCalls.push({ userId, id });
      if (options.findByIdResult === undefined || options.findByIdResult === null) return null;
      return { ...options.findByIdResult, status: 'preparing', prep_step: 'reading', error_code: null } as Interview;
    },
  };
  return {
    repository: repository as unknown as InterviewsRepository,
    created,
    markRetryingCalls,
  };
}

function buildService(options: {
  readonly config?: Partial<Env>;
  readonly profile?: Profile | null;
  readonly repoOptions?: FakeRepoOptions;
}) {
  const redis = fakeRedis();
  const jobs = fakeJobs();
  const { repository, created } = fakeRepository(options.repoOptions);
  const service = new InterviewsService(
    repository,
    fakeProfiles(options.profile === undefined ? profileFixture() : options.profile),
    redis,
    jobs,
    fakeConfig(options.config),
  );
  return { service, redis, jobs, created };
}

const TEXT_DTO: CreateInterviewDto = { type: 'mixed', offerText: 'We are hiring a backend engineer' };

describe('InterviewsService.create', () => {
  it('con una oferta de LinkedIn responde 422 OFFER_UNREADABLE sin consumir el tope', async () => {
    const { service, redis, jobs } = buildService({});

    const dto: CreateInterviewDto = { type: 'mixed', offerUrl: 'https://www.linkedin.com/jobs/123' };
    const error = await service.create(USER_ID, dto, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('OFFER_UNREADABLE');
    expect((error as ApiException).getStatus()).toBe(422);
    expect(redis.counters.size).toBe(0);
    expect(jobs.enqueued).toEqual([]);
  });

  it('detecta también el dominio corto lnkd.in', async () => {
    const { service } = buildService({});
    const dto: CreateInterviewDto = { type: 'mixed', offerUrl: 'https://lnkd.in/abc123' };
    const error = await service.create(USER_ID, dto, NOW).catch((caught: unknown) => caught);
    expect((error as ApiException).code).toBe('OFFER_UNREADABLE');
  });

  it('al pasarse del tope diario responde 429 INTERVIEWS_DAILY_CAP con retryAfter', async () => {
    const { service } = buildService({ config: { INTERVIEWS_DAILY_CAP: 1 } });

    await service.create(USER_ID, TEXT_DTO, NOW);
    const error = await service.create(USER_ID, TEXT_DTO, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('INTERVIEWS_DAILY_CAP');
    expect((error as ApiException).getStatus()).toBe(429);
    const body = (error as ApiException).getApiBody();
    expect(typeof body.retryAfter).toBe('number');
  });

  it('sin INTERVIEW_AGENT_URL responde 503', async () => {
    const { service } = buildService({ config: { INTERVIEW_AGENT_URL: undefined } });

    const error = await service.create(USER_ID, TEXT_DTO, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('INTERVIEW_AGENT_UNAVAILABLE');
    expect((error as ApiException).getStatus()).toBe(503);
  });

  it('con INTERVIEWS_REQUIRE_PRO y plan free responde 403 PLAN_REQUIRED', async () => {
    const { service } = buildService({
      config: { INTERVIEWS_REQUIRE_PRO: true },
      profile: profileFixture({ plan: 'free' }),
    });

    const error = await service.create(USER_ID, TEXT_DTO, NOW).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('PLAN_REQUIRED');
    expect((error as ApiException).getStatus()).toBe(403);
  });

  it('exige exactamente uno de offerText/offerUrl', async () => {
    const { service } = buildService({});

    const bothError = await service
      .create(USER_ID, { type: 'mixed', offerText: 'x', offerUrl: 'https://example.com' }, NOW)
      .catch((caught: unknown) => caught);
    const neitherError = await service.create(USER_ID, { type: 'mixed' }, NOW).catch((caught: unknown) => caught);

    expect((bothError as ApiException).code).toBe('VALIDATION');
    expect((neitherError as ApiException).code).toBe('VALIDATION');
  });

  it('con una oferta válida inserta, encola y devuelve la entrevista en preparing', async () => {
    const { service, jobs } = buildService({});

    const result = await service.create(USER_ID, TEXT_DTO, NOW);

    expect(result.status).toBe('preparing');
    expect(result.prepStep).toBe('reading');
    expect(jobs.enqueued).toEqual([result.id]);
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

  it('con una entrevista de otro usuario responde 404', async () => {
    // El repositorio filtra por user_id; simular "no encontrada" devolviendo null.
    const { service } = buildService({ repoOptions: { findByIdResult: null } });

    const error = await service.detail(OTHER_USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('NOT_FOUND');
    expect((error as ApiException).getStatus()).toBe(404);
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
});

describe('InterviewsService.getQuota', () => {
  it('descuenta lo ya usado hoy', async () => {
    const { service } = buildService({ config: { INTERVIEWS_DAILY_CAP: 3 } });

    await service.create(USER_ID, TEXT_DTO, NOW);
    const quota = await service.getQuota(USER_ID, NOW);

    expect(quota).toEqual({ remaining: 2, limit: 3, requiresPro: false, freeNotice: true });
  });
});
