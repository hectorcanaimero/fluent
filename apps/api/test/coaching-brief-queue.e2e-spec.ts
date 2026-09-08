/**
 * Criterio de aceptación de PR-05/T1 (`docs/tasks/PR-05-jobs.md`):
 * test de integración con **Redis real en Docker** (`testcontainers`) y LLM
 * simulado.
 *
 *   - job idempotente: dos ejecuciones sobre la misma sesión, un solo
 *     `apply_brief` y una sola llamada al LLM;
 *   - fallo del LLM → reintento con backoff, y `failed` al agotar los intentos.
 *
 * Se ejecuta con `pnpm --filter @fluent/api test:e2e` (vitest.config.e2e.ts,
 * `include: ['**\/*.e2e-spec.ts']`), NO con `pnpm --filter @fluent/api test`,
 * para que la suite unitaria siga tardando segundos y no dependa de Docker.
 * Ver PEND-08 de docs/specs/pendientes/PR-05.md.
 */
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { Queue, QueueEvents } from 'bullmq';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

import { validateEnv } from './../src/config/env.js';
import { CredentialsCrypto } from './../src/credentials/credentials.crypto.js';
import type { BriefJobStatus, Level } from './../src/db/schema.js';
import { LlmUnavailableError, LlmService } from './../src/llm/llm.service.js';
import { CoachingBriefProcessor } from './../src/jobs/coaching-brief/coaching-brief.processor.js';
import { CoachingBriefRepository } from './../src/jobs/coaching-brief/coaching-brief.repository.js';
import { CoachingBriefService } from './../src/jobs/coaching-brief/coaching-brief.service.js';
import { JOB_DISPATCHER, type JobDispatcher } from './../src/jobs/job-dispatcher.js';
import {
  BULL_PREFIX,
  JOB_COACHING_BRIEF,
  QUEUE_BRIEF,
} from './../src/jobs/jobs.constants.js';
import { QueuesModule } from './../src/jobs/queues.module.js';

// El reaper de testcontainers es otro contenedor más; se desactiva y el
// contenedor de Redis se para siempre en `afterAll` (try/finally).
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const USER_ID = '22222222-2222-4222-8222-222222222222';

interface SessionState {
  briefJobStatus: BriefJobStatus;
  applyBriefCalls: number;
}

/** Repositorio en memoria: este test comprueba las colas, no InsForge. */
class FakeRepository extends CoachingBriefRepository {
  readonly sessions = new Map<string, SessionState>();
  suggestedLevelWrites: Array<{ userId: string; level: Level }> = [];

  seed(sessionId: string): void {
    this.sessions.set(sessionId, { briefJobStatus: 'pending', applyBriefCalls: 0 });
  }

  private state(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`sesión ${sessionId} no sembrada en el test`);
    return state;
  }

  async loadSession(sessionId: string) {
    const state = this.sessions.get(sessionId);
    if (!state) return null;
    return {
      id: sessionId,
      user_id: USER_ID,
      kind: 'free_topic' as const,
      topic: 'weekend plans',
      brief_job_status: state.briefJobStatus,
    };
  }

  async markSessionRunning(sessionId: string) {
    this.state(sessionId).briefJobStatus = 'running';
  }

  async loadTurns() {
    return [
      { role: 'user' as const, text: 'I go to the beach yesterday' },
      { role: 'tutor' as const, text: 'You mean "I went to the beach".' },
    ];
  }

  async loadProfile() {
    return { level: 'B1' as const, locale: 'es' as const, suggested_level: null };
  }

  async loadCurrentBriefText() {
    return null;
  }

  async loadKnownFacts() {
    return [];
  }

  async loadModelPreference() {
    return null;
  }

  async loadActiveCredentials() {
    return [];
  }

  async applyBrief(args: { p_session_id: string }) {
    const state = this.state(args.p_session_id);
    state.applyBriefCalls += 1;
    state.briefJobStatus = 'done';
    return { applied: true, facts_inserted: 1, facts_skipped: 0 };
  }

  async recentHistoryLevelHints() {
    return [] as (Level | null)[];
  }

  async updateSuggestedLevel(userId: string, level: Level) {
    this.suggestedLevelWrites.push({ userId, level });
  }


}

const LLM_OK = {
  data: {
    brief: 'Keep drilling past simple.',
    facts: [{ text: 'The learner went to the beach.', happens_on: null }],
    level_hint: 'B2' as const,
    recurring_errors: [],
  },
  modelUsed: 'test/model',
  provider: 'openrouter' as const,
  usage: { tokensIn: 10, tokensOut: 5 },
  degraded: false,
  attempts: [],
};

describe('cola brief + coaching-brief (e2e con Redis real)', () => {
  let container: StartedTestContainer;
  let moduleRef: TestingModule;
  let queue: Queue;
  let queueEvents: QueueEvents;
  let dispatcher: JobDispatcher;
  let repository: FakeRepository;
  let complete: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    const redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    // `@nestjs/config` no pisa lo que ya está en `process.env`, así que esta
    // URL gana sobre la de `.env.test`.
    process.env.REDIS_URL = redisUrl;

    repository = new FakeRepository();
    complete = vi.fn(async () => LLM_OK);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: validateEnv,
          envFilePath: '.env.test',
        }),
        QueuesModule,
      ],
      providers: [
        { provide: CoachingBriefRepository, useValue: repository },
        { provide: LlmService, useValue: { complete } },
        CredentialsCrypto,
        CoachingBriefService,
        CoachingBriefProcessor,
      ],
    }).compile();

    await moduleRef.init();

    queue = moduleRef.get<Queue>(getQueueToken(QUEUE_BRIEF));
    dispatcher = moduleRef.get<JobDispatcher>(JOB_DISPATCHER);
    queueEvents = new QueueEvents(QUEUE_BRIEF, {
      connection: { url: redisUrl, maxRetriesPerRequest: null },
      prefix: BULL_PREFIX,
    });
    await queueEvents.waitUntilReady();
  }, 180_000);

  afterAll(async () => {
    try {
      await queueEvents?.close();
      await moduleRef?.close();
    } finally {
      // El contenedor se para pase lo que pase.
      await container?.stop();
    }
  }, 60_000);

  beforeEach(() => {
    complete.mockReset();
    complete.mockResolvedValue(LLM_OK);
    repository.suggestedLevelWrites = [];
  });

  it('registra la cola con el prefijo y los reintentos de SPEC-05 §1', () => {
    expect(queue.opts.prefix).toBe(BULL_PREFIX);
    expect(queue.opts.defaultJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
    });
  });

  it('JobDispatcher usa jobId = sessionId y no duplica el encolado', async () => {
    const sessionId = 'aaaaaaaa-0000-4000-8000-000000000001';
    await queue.pause();
    try {
      await dispatcher.enqueueCoachingBrief(sessionId);
      await dispatcher.enqueueCoachingBrief(sessionId);

      expect(await queue.getWaitingCount()).toBe(1);
      const job = await queue.getJob(sessionId);
      expect(job?.data).toEqual({ sessionId });
      expect(job?.name).toBe(JOB_COACHING_BRIEF);
    } finally {
      await queue.obliterate({ force: true });
      await queue.resume();
    }
  });

  it('es idempotente: dos ejecuciones dejan un solo apply_brief', async () => {
    const sessionId = 'aaaaaaaa-0000-4000-8000-000000000002';
    repository.seed(sessionId);

    const first = await queue.add(
      JOB_COACHING_BRIEF,
      { sessionId },
      { jobId: `${sessionId}-run1` },
    );
    expect(await first.waitUntilFinished(queueEvents, 30_000)).toMatchObject({
      status: 'applied',
    });

    const second = await queue.add(
      JOB_COACHING_BRIEF,
      { sessionId },
      { jobId: `${sessionId}-run2` },
    );
    expect(await second.waitUntilFinished(queueEvents, 30_000)).toEqual({
      status: 'skipped',
      reason: 'already_done',
    });

    expect(repository.sessions.get(sessionId)?.applyBriefCalls).toBe(1);
    expect(complete).toHaveBeenCalledOnce();
  }, 60_000);

  it('un fallo del LLM reintenta con backoff y termina bien en el 2.º intento', async () => {
    const sessionId = 'aaaaaaaa-0000-4000-8000-000000000003';
    repository.seed(sessionId);

    const attemptTimes: number[] = [];
    complete.mockImplementation(async () => {
      attemptTimes.push(Date.now());
      if (attemptTimes.length === 1) throw new LlmUnavailableError([]);
      return LLM_OK;
    });

    // Backoff corto: la política real de la cola es exponencial de 30 s
    // (comprobada arriba) y aquí solo interesa que BullMQ la aplique.
    const job = await queue.add(
      JOB_COACHING_BRIEF,
      { sessionId },
      { jobId: sessionId, attempts: 3, backoff: { type: 'fixed', delay: 300 } },
    );

    expect(job.opts.backoff).toEqual({ type: 'fixed', delay: 300 });
    expect(await job.waitUntilFinished(queueEvents, 30_000)).toMatchObject({
      status: 'applied',
    });

    expect(complete).toHaveBeenCalledTimes(2);
    // El segundo intento no fue inmediato: BullMQ pasó el job a `delayed`.
    expect(attemptTimes[1] - attemptTimes[0]).toBeGreaterThanOrEqual(250);

    const finished = await queue.getJob(sessionId);
    expect(finished?.attemptsMade).toBe(2);
    expect(repository.sessions.get(sessionId)?.applyBriefCalls).toBe(1);
  }, 60_000);

  it('tras agotar los intentos el job queda failed', async () => {
    const sessionId = 'aaaaaaaa-0000-4000-8000-000000000004';
    repository.seed(sessionId);
    complete.mockImplementation(async () => {
      throw new LlmUnavailableError([]);
    });

    const job = await queue.add(
      JOB_COACHING_BRIEF,
      { sessionId },
      { jobId: sessionId, attempts: 3, backoff: { type: 'fixed', delay: 100 } },
    );

    await expect(job.waitUntilFinished(queueEvents, 30_000)).rejects.toThrow();

    const failed = await queue.getJob(sessionId);
    expect(await failed?.getState()).toBe('failed');
    expect(failed?.attemptsMade).toBe(3);
    expect(complete).toHaveBeenCalledTimes(3);
    // La sesión no llegó a `done`: el reencolado de SPEC-05 §2 la reprocesará.
    expect(repository.sessions.get(sessionId)?.briefJobStatus).toBe('running');
    expect(repository.sessions.get(sessionId)?.applyBriefCalls).toBe(0);
  }, 60_000);
});
