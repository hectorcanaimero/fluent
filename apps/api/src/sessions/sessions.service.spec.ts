import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import { CALLBACK_PROBABILITY } from '../config/product.js';
import { BOSS_TOPICS, ROLEPLAYS, TOPICS } from '../content/index.js';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { Fact, NewsItem, Profile, Session } from '../db/schema.js';
import {
  BossService,
  type BossRepository,
  type BossSkipStore,
} from '../game/boss.service.js';
import { isoDateString } from '../game/iso-week.js';
import { LlmService, LlmUnavailableError } from '../llm/llm.service.js';
import type { LlmMessage } from '../llm/llm.client.js';
import { OPENING_USER_MESSAGE } from '../llm/prompts/turn.js';
import type { JobDispatcher } from '../jobs/job-dispatcher.js';
import type { ChallengesService } from '../social/challenges.service.js';
import type { ChallengesResultDto } from '../social/social.types.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import { SESSION_OPENINGS } from './session-openings.js';
import { SessionsService } from './sessions.service.js';
import type { SessionsRepository } from './sessions.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_ID = '11111111-1111-4111-8111-111111111111';

const ROLEPLAY = ROLEPLAYS[0]!;
const B1_BOSS_TOPIC = BOSS_TOPICS.find((topic) => topic.level_min === 'B1')!;
const CATALOG_TOPIC = TOPICS[0]!;

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: USER_ID,
    group_id: null,
    display_name: 'Ana',
    level: 'B1',
    suggested_level: null,
    interests: ['tech'],
    timezone: 'Europe/Madrid',
    locale: 'es',
    xp: 0,
    streak: 0,
    longest_streak: 0,
    last_session_day: null,
    grace_used_week: null,
    sessions_count: 0,
    onboarded_at: '2026-09-01T10:00:00.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function sessionFixture(overrides: Partial<Session> = {}): Session {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: USER_ID,
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
    ...overrides,
  };
}

function factFixture(overrides: Partial<Fact> = {}): Fact {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    user_id: USER_ID,
    text: 'She is running a marathon in October',
    happens_on: '2026-10-11',
    status: 'confirmed',
    source_session_id: null,
    last_used_at: null,
    use_count: 0,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function newsFixture(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    source: 'BBC World',
    url: 'https://example.test/news',
    title: 'Solar power beats coal in Europe',
    summary: 'Solar overtook coal for the first time.',
    tags: ['science'],
    published_at: new Date().toISOString(),
    day: isoDateString(new Date()),
    ...overrides,
  };
}

interface FakeRepoOptions {
  readonly profile?: Profile | null;
  readonly activeSessionId?: string | null;
  readonly preference?: { provider: 'openrouter' | 'gemini'; model: string } | null;
  readonly newsItem?: NewsItem | null;
  readonly brief?: string | null;
  readonly facts?: Fact[];
  readonly lastSession?: { found: boolean; callbackFactId: string | null };
  readonly callbackFact?: Fact | null;
  /** Sesión con el brief fallido que `openSession` debe reencolar (MAL-20). */
  readonly failedBriefSessionId?: string | null;
}

type FakeRepo = SessionsRepository & {
  readonly created: unknown[];
  readonly updates: unknown[];
  readonly turns: unknown[];
  readonly deleted: string[];
  readonly pickCallbackCalls: string[];
};

function fakeRepository(options: FakeRepoOptions = {}): FakeRepo {
  const created: unknown[] = [];
  const updates: unknown[] = [];
  const turns: unknown[] = [];
  const deleted: string[] = [];
  const pickCallbackCalls: string[] = [];
  let inserted: Session | null = null;

  const repo = {
    created,
    updates,
    turns,
    deleted,
    pickCallbackCalls,
    findProfile: async () =>
      options.profile === undefined ? profileFixture() : options.profile,
    findActiveSessionId: async () => options.activeSessionId ?? null,
    findChatModelPreference: async () => options.preference ?? null,
    findNewsItem: async () => options.newsItem ?? null,
    findBriefText: async () => options.brief ?? null,
    listConfirmedFacts: async () => options.facts ?? [],
    findLastSessionCallback: async () =>
      options.lastSession ?? { found: false, callbackFactId: null },
    findRecentFailedBriefSessionId: async () => options.failedBriefSessionId ?? null,
    pickCallbackFact: async (userId: string) => {
      pickCallbackCalls.push(userId);
      return options.callbackFact ?? null;
    },
    createSession: async (row: unknown) => {
      created.push(row);
      const typed = row as { kind: Session['kind']; topic: string; newsItemId?: string | null };
      inserted = sessionFixture({
        kind: typed.kind,
        topic: typed.topic,
        news_item_id: typed.kind === 'news' ? (typed.newsItemId ?? null) : null,
      });
      return inserted;
    },
    updateAfterOpening: async (_userId: string, sessionId: string, patch: unknown) => {
      updates.push({ sessionId, patch });
      const typed = patch as { chatModelUsed?: string | null; callbackFactId?: string | null };
      // Igual que el UPDATE real: devuelve la fila ya creada con el parche
      // aplicado, no una fila nueva.
      inserted = {
        ...(inserted ?? sessionFixture()),
        chat_model_used: typed.chatModelUsed ?? null,
        callback_fact_id: typed.callbackFactId ?? null,
      };
      return inserted;
    },
    deleteSession: async (_userId: string, sessionId: string) => {
      deleted.push(sessionId);
    },
    insertOpeningTurn: async (row: unknown) => {
      turns.push(row);
    },
  };

  return repo as unknown as FakeRepo;
}

function fakeCredentials(providers: readonly ('openrouter' | 'gemini')[] = ['openrouter']) {
  return {
    listActive: async () => providers.map((provider) => ({ provider, apiKey: 'k' })),
  } as unknown as CredentialsService;
}

interface FakeLlmOptions {
  readonly reply?: string;
  readonly unavailable?: boolean;
  readonly error?: Error;
}

type FakeLlm = LlmService & { readonly calls: Array<{ messages: readonly LlmMessage[] }> };

function fakeLlm(options: FakeLlmOptions = {}): FakeLlm {
  const calls: Array<{ messages: readonly LlmMessage[] }> = [];
  const service = {
    calls,
    complete: async (request: { messages: readonly LlmMessage[] }) => {
      calls.push({ messages: request.messages });
      if (options.error) throw options.error;
      if (options.unavailable) throw new LlmUnavailableError([]);
      return {
        data: { reply: options.reply ?? 'Hello! What did you do today?', corrections: [] },
        modelUsed: 'gemini-2.5-flash',
        provider: 'gemini' as const,
        usage: { tokensIn: 120, tokensOut: 40 },
        degraded: false,
        attempts: [
          {
            attempt: 1,
            provider: 'gemini' as const,
            model: 'gemini-2.5-flash',
            source: 'fallback' as const,
            status: 'ok' as const,
            latencyMs: 1234.6,
          },
        ],
      };
    },
  };
  return service as unknown as FakeLlm;
}

function fakeBoss(options: { usedTopicIds?: string[]; skippedDays?: string[] } = {}) {
  const recordSkipCalls: Array<{ userId: string; day: string }> = [];
  const skipped = new Set(options.skippedDays ?? []);

  const repo: BossRepository = {
    getUsedBossTopicIds: async () => new Set(options.usedTopicIds ?? []),
  };
  const store: BossSkipStore = {
    wasSkippedToday: async (_userId, day) => skipped.has(day),
    recordSkip: async (userId, day) => {
      recordSkipCalls.push({ userId, day });
      skipped.add(day);
    },
  };

  return { service: new BossService(repo, store), recordSkipCalls };
}

/**
 * `ChallengesService` de mentira para MAL-19: devuelve los desafíos que se le
 * pasen y anota a quién se le preguntó. Por defecto, ninguno — así los tests
 * que no mandan `challengeFromUserId` no se ven afectados.
 */
function fakeChallenges(
  options: { items?: ChallengesResultDto['items']; error?: unknown } = {},
) {
  const calls: string[] = [];
  const service = {
    listChallenges: async (userId: string): Promise<ChallengesResultDto> => {
      calls.push(userId);
      if (options.error) throw options.error;
      return { items: options.items ?? [] };
    },
  };
  return { service: service as unknown as ChallengesService, calls };
}

/** `JobDispatcher` de mentira: anota qué sesiones se reencolan (MAL-20). */
function fakeJobs(options: { fails?: boolean } = {}) {
  const enqueued: string[] = [];
  const dispatcher = {
    enqueueCoachingBrief: async (sessionId: string) => {
      enqueued.push(sessionId);
      if (options.fails) throw new Error('cola caída');
    },
  };
  return { enqueued, dispatcher: dispatcher as unknown as JobDispatcher };
}

const configService = { get: () => 3 } as unknown as ConfigService<never, true>;

interface BuildOptions extends FakeRepoOptions {
  readonly llm?: FakeLlm;
  readonly random?: number;
  readonly credentialProviders?: readonly ('openrouter' | 'gemini')[];
  readonly boss?: ReturnType<typeof fakeBoss>;
  readonly challenges?: ReturnType<typeof fakeChallenges>;
}

function buildService(options: BuildOptions = {}) {
  const repository = fakeRepository(options);
  const llm = options.llm ?? fakeLlm();
  const boss = options.boss ?? fakeBoss();
  const challenges = options.challenges ?? fakeChallenges();
  const jobs = fakeJobs();
  const service = new SessionsService(
    repository,
    fakeCredentials(options.credentialProviders),
    llm,
    boss.service,
    challenges.service,
    jobs.dispatcher,
    configService as never,
    () => options.random ?? 0.99,
  );
  return { service, repository, llm, boss, challenges, jobs };
}

function systemPromptOf(llm: FakeLlm): string {
  return llm.calls[0]!.messages[0]!.content;
}

describe('SessionsService.openSession · validación previa (SPEC-04 §3.1, §2)', () => {
  it('sin fila en `profiles` → 409 NOT_ONBOARDED', async () => {
    const { service } = buildService({ profile: null });

    await expect(service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' })).rejects.toMatchObject(
      { code: 'NOT_ONBOARDED' },
    );
  });

  it('con `onboarded_at` nulo → 409 NOT_ONBOARDED', async () => {
    const { service } = buildService({ profile: profileFixture({ onboarded_at: null }) });

    await expect(
      service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' }),
    ).rejects.toMatchObject({ code: 'NOT_ONBOARDED' });
  });

  it('con una sesión activa → 409 SESSION_ALREADY_ACTIVE con `activeSessionId` en el cuerpo', async () => {
    const activeSessionId = '99999999-9999-4999-8999-999999999999';
    const { service } = buildService({ activeSessionId });

    const error = await service
      .openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('SESSION_ALREADY_ACTIVE');
    expect((error as ApiException).getApiBody()).toMatchObject({
      error: 'SESSION_ALREADY_ACTIVE',
      statusCode: 409,
      activeSessionId,
    });
  });

  it('sin credencial activa → 409 PROVIDER_NOT_CONNECTED', async () => {
    const { service } = buildService({ credentialProviders: [] });

    await expect(
      service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONNECTED' });
  });
});

describe('SessionsService.openSession · los cuatro kind (SPEC-04 §3.2)', () => {
  it('free_topic guarda el texto del usuario en `topic` y responde 201 con la apertura', async () => {
    const { service, repository, llm } = buildService({ llm: fakeLlm({ reply: 'Hi! Where to?' }) });

    const result = await service.openSession(USER_ID, { kind: 'free_topic', topic: '  Viajes  ' });

    expect(result.opening).toEqual({ text: 'Hi! Where to?', callbackUsed: false });
    expect(result.session.kind).toBe('free_topic');
    expect(result.session.topic).toBe('Viajes');
    expect(repository.created).toEqual([
      {
        userId: USER_ID,
        kind: 'free_topic',
        topic: 'Viajes',
        newsItemId: undefined,
        challengeFromUserId: null,
      },
    ]);
    // El mensaje del usuario en la apertura es el fijo de SPEC-04 §3.4.
    expect(llm.calls[0]!.messages.at(-1)).toEqual({
      role: 'user',
      content: OPENING_USER_MESSAGE,
    });
  });

  it('free_topic con un tema del catálogo usa su `prompt_en` en el prompt', async () => {
    const { service, llm } = buildService();

    await service.openSession(USER_ID, { kind: 'free_topic', topic: CATALOG_TOPIC.title_es });

    expect(systemPromptOf(llm)).toContain(`Topic: ${CATALOG_TOPIC.prompt_en}.`);
  });

  it('free_topic sin `topic` → 400 VALIDATION', async () => {
    const { service } = buildService();

    await expect(service.openSession(USER_ID, { kind: 'free_topic' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('roleplay guarda `title_es` como topic y manda rol y situación al modelo', async () => {
    const { service, llm } = buildService();

    const result = await service.openSession(USER_ID, {
      kind: 'roleplay',
      roleplayId: ROLEPLAY.id,
    });

    expect(result.session.topic).toBe(ROLEPLAY.title_es);
    expect(systemPromptOf(llm)).toContain(`You play ${ROLEPLAY.role}`);
    expect(systemPromptOf(llm)).toContain(ROLEPLAY.situation);
  });

  it('roleplay con id desconocido → 400 VALIDATION', async () => {
    const { service } = buildService();

    await expect(
      service.openSession(USER_ID, { kind: 'roleplay', roleplayId: 'no-existe' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('roleplay sin `roleplayId` → 400 VALIDATION', async () => {
    const { service } = buildService();

    await expect(service.openSession(USER_ID, { kind: 'roleplay' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('news guarda el título como topic y el `news_item_id` de la fila', async () => {
    const item = newsFixture();
    const { service, repository, llm } = buildService({ newsItem: item });

    const result = await service.openSession(USER_ID, {
      kind: 'news',
      newsItemId: item.id,
    });

    expect(result.session.topic).toBe(item.title);
    expect(repository.created[0]).toMatchObject({ kind: 'news', newsItemId: item.id });
    expect(systemPromptOf(llm)).toContain(`Discuss this news: "${item.title}"`);
  });

  it('news inexistente → 400 VALIDATION', async () => {
    const { service } = buildService({ newsItem: null });

    await expect(
      service.openSession(USER_ID, {
        kind: 'news',
        newsItemId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('news de hace más de 14 días → 400 VALIDATION', async () => {
    const item = newsFixture({ day: isoDateString(new Date(Date.now() - 15 * DAY_MS)) });
    const { service } = buildService({ newsItem: item });

    await expect(
      service.openSession(USER_ID, { kind: 'news', newsItemId: item.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('boss toma el tema de BOSS_TOPICS y usa su `prompt_en`', async () => {
    const { service, llm } = buildService({ profile: profileFixture({ level: 'B1' }) });

    const result = await service.openSession(USER_ID, { kind: 'boss' });

    expect(result.session.topic).toBe(B1_BOSS_TOPIC.title_es);
    expect(systemPromptOf(llm)).toContain(B1_BOSS_TOPIC.prompt_en);
  });

  it('boss sin temas alcanzables (nivel A2) → 400 VALIDATION', async () => {
    const { service } = buildService({ profile: profileFixture({ level: 'A2' }) });

    await expect(service.openSession(USER_ID, { kind: 'boss' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});

const CHALLENGER_ID = '22222222-2222-4222-8222-222222222222';

/** Candidato tal y como lo devuelve `GET /challenges` (SPEC-02 §4.5). */
function challengeFixture(
  overrides: Partial<ChallengesResultDto['items'][number]> = {},
): ChallengesResultDto['items'][number] {
  return {
    fromUserId: CHALLENGER_ID,
    displayName: 'Ana',
    topic: 'Viajes',
    kind: 'free_topic',
    sessionId: '33333333-3333-4333-8333-333333333333',
    ...overrides,
  };
}

describe('SessionsService.openSession · validación del desafío (SPEC-07 §7, MAL-19)', () => {
  it('acepta el desafío que GET /challenges ofrece y lo persiste', async () => {
    const challenges = fakeChallenges({ items: [challengeFixture()] });
    const { service, repository } = buildService({ challenges });

    await service.openSession(USER_ID, {
      kind: 'free_topic',
      topic: 'Viajes',
      challengeFromUserId: CHALLENGER_ID,
    });

    expect(challenges.calls).toEqual([USER_ID]);
    expect(repository.created).toEqual([
      expect.objectContaining({ challengeFromUserId: CHALLENGER_ID }),
    ]);
  });

  it('rechaza un challengeFromUserId que no está en la lista', async () => {
    const challenges = fakeChallenges({ items: [challengeFixture()] });
    const { service, repository } = buildService({ challenges });

    await expect(
      service.openSession(USER_ID, {
        kind: 'free_topic',
        topic: 'Viajes',
        challengeFromUserId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_AVAILABLE' });

    expect(repository.created).toEqual([]);
  });

  it('rechaza el desafío correcto con otro tema', async () => {
    const challenges = fakeChallenges({ items: [challengeFixture({ topic: 'Cocina' })] });
    const { service } = buildService({ challenges });

    await expect(
      service.openSession(USER_ID, {
        kind: 'free_topic',
        topic: 'Viajes',
        challengeFromUserId: CHALLENGER_ID,
      }),
    ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_AVAILABLE' });
  });

  it('acepta un desafío de otro kind reabierto como free_topic', async () => {
    // `GET /challenges` ofrece los cuatro kind pero no expone `roleplayId` ni
    // `newsItemId`, así que la app los reabre todos como `free_topic` con el
    // tema legible. Exigir que el `kind` coincidiera dejaba sin aceptar todo
    // desafío que no fuera `free_topic`.
    const challenges = fakeChallenges({
      items: [challengeFixture({ kind: 'roleplay', topic: 'Viajes' })],
    });
    const { service, repository } = buildService({ challenges });

    await service.openSession(USER_ID, {
      kind: 'free_topic',
      topic: 'Viajes',
      challengeFromUserId: CHALLENGER_ID,
    });

    expect(repository.created).toEqual([
      expect.objectContaining({ challengeFromUserId: CHALLENGER_ID }),
    ]);
  });

  it('un challengeFromUserId null explícito es "sin desafío"', async () => {
    const challenges = fakeChallenges();
    const { service, repository } = buildService({ challenges });

    await service.openSession(USER_ID, {
      kind: 'free_topic',
      topic: 'Viajes',
      challengeFromUserId: undefined as unknown as string,
    });

    expect(challenges.calls).toEqual([]);
    expect(repository.created).toEqual([
      expect.objectContaining({ challengeFromUserId: null }),
    ]);
  });

  it('un desafío rechazado no quema la oferta de boss del día', async () => {
    const boss = fakeBoss();
    const challenges = fakeChallenges({ items: [] });
    const { service } = buildService({
      profile: profileFixture({ sessions_count: 6 }),
      boss,
      challenges,
    });

    await expect(
      service.openSession(USER_ID, {
        kind: 'free_topic',
        topic: 'Viajes',
        challengeFromUserId: CHALLENGER_ID,
      }),
    ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_AVAILABLE' });

    expect(boss.recordSkipCalls).toEqual([]);
  });

  it('traduce el NOT_ONBOARDED de un usuario sin grupo al mismo 422', async () => {
    const challenges = fakeChallenges({
      error: new ApiException('NOT_ONBOARDED', 'Sin grupo.'),
    });
    const { service } = buildService({ challenges });

    await expect(
      service.openSession(USER_ID, {
        kind: 'free_topic',
        topic: 'Viajes',
        challengeFromUserId: CHALLENGER_ID,
      }),
    ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_AVAILABLE' });
  });

  it('propaga cualquier otro error de la lista de desafíos', async () => {
    const challenges = fakeChallenges({ error: new Error('InsForge caído') });
    const { service } = buildService({ challenges });

    await expect(
      service.openSession(USER_ID, {
        kind: 'free_topic',
        topic: 'Viajes',
        challengeFromUserId: CHALLENGER_ID,
      }),
    ).rejects.toThrow('InsForge caído');
  });

  it('sin challengeFromUserId no consulta la lista de desafíos', async () => {
    const challenges = fakeChallenges();
    const { service, repository } = buildService({ challenges });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    expect(challenges.calls).toEqual([]);
    expect(repository.created).toEqual([
      expect.objectContaining({ challengeFromUserId: null }),
    ]);
  });
});

describe('SessionsService.openSession · rechazo del boss (SPEC-04 §3.2, SPEC-07 §4)', () => {
  it('si tocaba boss y se pide otro kind, se registra el rechazo del día', async () => {
    const boss = fakeBoss();
    const { service } = buildService({
      profile: profileFixture({ sessions_count: 6 }),
      boss,
    });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    expect(boss.recordSkipCalls).toEqual([
      { userId: USER_ID, day: isoDateString(new Date()) },
    ]);
  });

  it('si no tocaba boss no se registra ningún rechazo', async () => {
    const boss = fakeBoss();
    const { service } = buildService({
      profile: profileFixture({ sessions_count: 2 }),
      boss,
    });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    expect(boss.recordSkipCalls).toEqual([]);
  });

  it('si se acepta el boss no se registra rechazo', async () => {
    const boss = fakeBoss();
    const { service } = buildService({
      profile: profileFixture({ sessions_count: 6, level: 'B1' }),
      boss,
    });

    await service.openSession(USER_ID, { kind: 'boss' });

    expect(boss.recordSkipCalls).toEqual([]);
  });

  it('una petición que falla la validación no registra rechazo', async () => {
    const boss = fakeBoss();
    const { service } = buildService({
      profile: profileFixture({ sessions_count: 6 }),
      boss,
    });

    await expect(service.openSession(USER_ID, { kind: 'free_topic' })).rejects.toBeInstanceOf(
      ApiException,
    );
    expect(boss.recordSkipCalls).toEqual([]);
  });
});

describe('SessionsService.openSession · callback de memoria (RF-4.4, SPEC-04 §3.3)', () => {
  const dto: CreateSessionDto = { kind: 'free_topic', topic: 'Viajes' };

  it(`random < ${CALLBACK_PROBABILITY} y sesión anterior sin callback → se usa el hecho`, async () => {
    const fact = factFixture();
    const { service, repository, llm } = buildService({
      random: CALLBACK_PROBABILITY - 0.01,
      lastSession: { found: true, callbackFactId: null },
      callbackFact: fact,
    });

    const result = await service.openSession(USER_ID, dto);

    expect(result.opening.callbackUsed).toBe(true);
    expect(repository.pickCallbackCalls).toEqual([USER_ID]);
    expect(systemPromptOf(llm)).toContain(fact.text);
    expect(repository.updates[0]).toMatchObject({ patch: { callbackFactId: fact.id } });
  });

  it(`random >= ${CALLBACK_PROBABILITY} → ni siquiera se consulta la RPC`, async () => {
    const { service, repository, llm } = buildService({
      random: CALLBACK_PROBABILITY,
      callbackFact: factFixture(),
    });

    const result = await service.openSession(USER_ID, dto);

    expect(result.opening.callbackUsed).toBe(false);
    expect(repository.pickCallbackCalls).toEqual([]);
    expect(systemPromptOf(llm)).toContain(
      '6. Open with a warm one-sentence greeting and the first question about the topic.',
    );
  });

  it('si la sesión anterior ya usó callback, no se vuelve a usar', async () => {
    const { service, repository } = buildService({
      random: 0,
      lastSession: { found: true, callbackFactId: 'abc' },
      callbackFact: factFixture(),
    });

    const result = await service.openSession(USER_ID, dto);

    expect(result.opening.callbackUsed).toBe(false);
    expect(repository.pickCallbackCalls).toEqual([]);
  });

  it('sin sesiones previas cuenta como «la anterior no usó callback»', async () => {
    const { service, repository } = buildService({
      random: 0,
      lastSession: { found: false, callbackFactId: null },
      callbackFact: factFixture(),
    });

    const result = await service.openSession(USER_ID, dto);

    expect(result.opening.callbackUsed).toBe(true);
    expect(repository.pickCallbackCalls).toEqual([USER_ID]);
  });

  it('si la RPC no devuelve hecho, `callbackUsed` es false', async () => {
    const { service } = buildService({ random: 0, callbackFact: null });

    const result = await service.openSession(USER_ID, dto);

    expect(result.opening.callbackUsed).toBe(false);
  });
});

describe('SessionsService.openSession · persistencia (SPEC-04 §3.5)', () => {
  it('guarda `chat_model_used` y el turno 0 del tutor con modelo, tokens y latencia', async () => {
    const { service, repository } = buildService();

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    expect(repository.updates[0]).toMatchObject({
      patch: { chatModelUsed: 'gemini-2.5-flash', callbackFactId: null },
    });
    expect(repository.turns).toEqual([
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
        text: 'Hello! What did you do today?',
        model: 'gemini-2.5-flash',
        tokensIn: 120,
        tokensOut: 40,
        latencyMs: 1235,
      },
    ]);
  });

  it('mete el brief y hasta 3 hechos confirmados en el prompt (SPEC-03 §3)', async () => {
    const facts = [
      factFixture({ id: 'f1', text: 'Works as a nurse' }),
      factFixture({ id: 'f2', text: 'Has a dog called Kira' }),
      factFixture({ id: 'f3', text: 'Plays padel on Sundays' }),
    ];
    const { service, llm } = buildService({ brief: 'Push past simple.', facts });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    const prompt = systemPromptOf(llm);
    expect(prompt).toContain('Push past simple.');
    for (const fact of facts) {
      expect(prompt).toContain(`- ${fact.text}`);
    }
  });

  it('un error inesperado del LLM borra la sesión recién creada y se propaga', async () => {
    const boom = new Error('boom');
    const { service, repository } = buildService({ llm: fakeLlm({ error: boom }) });

    await expect(
      service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' }),
    ).rejects.toBe(boom);
    expect(repository.deleted).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(repository.turns).toEqual([]);
  });
});

describe('SessionsService.openSession · apertura degradada (SPEC-04 §3, SPEC-03 §6)', () => {
  it('cadena agotada → saludo fijo del kind, sesión activa y turno sin modelo', async () => {
    const { service, repository } = buildService({ llm: fakeLlm({ unavailable: true }) });

    const result = await service.openSession(USER_ID, {
      kind: 'roleplay',
      roleplayId: ROLEPLAY.id,
    });

    expect(result.opening).toEqual({
      text: SESSION_OPENINGS.roleplay,
      callbackUsed: false,
    });
    expect(result.session.modelUsed).toBeNull();
    expect(repository.deleted).toEqual([]);
    expect(repository.turns).toEqual([
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
        text: SESSION_OPENINGS.roleplay,
        model: null,
        tokensIn: null,
        tokensOut: null,
        latencyMs: null,
      },
    ]);
  });

  it('con hecho elegido pero apertura degradada, `callbackUsed` es false y no se guarda el hecho', async () => {
    const { service, repository } = buildService({
      llm: fakeLlm({ unavailable: true }),
      random: 0,
      callbackFact: factFixture(),
    });

    const result = await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });

    expect(result.opening.callbackUsed).toBe(false);
    expect(repository.updates[0]).toMatchObject({
      patch: { chatModelUsed: null, callbackFactId: null },
    });
  });

  it('hay un saludo fijo distinto para cada uno de los cuatro kind', () => {
    const texts = Object.values(SESSION_OPENINGS);
    expect(texts).toHaveLength(4);
    expect(new Set(texts).size).toBe(4);
    for (const text of texts) {
      expect(text.trim().endsWith('?')).toBe(true);
    }
  });
});

describe('SessionsService.openSession · recuperación del brief fallido (MAL-20)', () => {
  it('reencola el brief de la última sesión fallida reciente', async () => {
    const { service, jobs } = buildService({ failedBriefSessionId: 'sesion-fallida' });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });
    // El reencolado no bloquea la apertura, así que se deja correr la cola
    // de microtareas antes de comprobarlo.
    await new Promise((resolve) => setImmediate(resolve));

    expect(jobs.enqueued).toEqual(['sesion-fallida']);
  });

  it('no reencola nada si no hay briefs fallidos recientes', async () => {
    const { service, jobs } = buildService({ failedBriefSessionId: null });

    await service.openSession(USER_ID, { kind: 'free_topic', topic: 'Viajes' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(jobs.enqueued).toEqual([]);
  });

  it('una cola caída no impide abrir la sesión', async () => {
    const repository = fakeRepository({ failedBriefSessionId: 'sesion-fallida' });
    const jobs = fakeJobs({ fails: true });
    const service = new SessionsService(
      repository,
      fakeCredentials(),
      fakeLlm(),
      fakeBoss().service,
      fakeChallenges().service,
      jobs.dispatcher,
      configService as never,
      () => 0.99,
    );

    const result = await service.openSession(USER_ID, {
      kind: 'free_topic',
      topic: 'Viajes',
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.session.id).toBeTruthy();
  });
});
