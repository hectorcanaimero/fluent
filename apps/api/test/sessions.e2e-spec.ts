import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';
import { BOSS_TOPICS, ROLEPLAYS } from '../src/content/index.js';
import { CredentialsService } from '../src/credentials/credentials.service.js';
import { LlmService } from '../src/llm/llm.service.js';
import { SESSION_RANDOM } from '../src/sessions/sessions.constants.js';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  loadInsforgeE2eCredentials,
  registerE2eUser,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';
import {
  seedGroupWithMembers,
  seedProfile,
  seedSession,
  type SeededMember,
} from './fixtures.js';

/**
 * e2e de PR-04/T1 (`POST /sessions`, SPEC-04 §3) contra la rama real de
 * InsForge, con el LLM **siempre** simulado (`.overrideProvider(LlmService)`):
 * ninguna suite puede llegar a un proveedor real (regla 6 del diseño de PR-04).
 *
 * Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` / `INSFORGE_ANON_KEY` en
 * `process.env` o en el archivo gitignored `apps/api/.env.test.local`; si no
 * están, se salta entero (el CI no tiene acceso a InsForge). Mismo patrón que
 * `apps/api/test/memory.e2e-spec.ts`.
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de apertura de sesión (docs/tasks/PR-04-sesion.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

const ROLEPLAY = ROLEPLAYS[0]!;
const B1_BOSS_TOPIC = BOSS_TOPICS.find((topic) => topic.level_min === 'B1')!;

const FAKE_REPLY = 'Hi there! What did you do last weekend?';
const FAKE_MODEL = 'fake/e2e-model';

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Doble de `LlmService` que nunca sale a la red (SPEC-03 §1). */
function fakeLlmService() {
  return {
    complete: async () => ({
      data: { reply: FAKE_REPLY, corrections: [] },
      modelUsed: FAKE_MODEL,
      provider: 'openrouter' as const,
      usage: { tokensIn: 200, tokensOut: 60 },
      degraded: false,
      attempts: [
        {
          attempt: 1,
          provider: 'openrouter' as const,
          model: FAKE_MODEL,
          source: 'fallback' as const,
          status: 'ok' as const,
          latencyMs: 42,
        },
      ],
    }),
  };
}

maybeDescribe('Apertura de sesión (e2e, InsForge)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];
  const seededSessionIds: string[] = [];
  const seededFactIds: string[] = [];
  const seededNewsIds: string[] = [];

  /** Valor que devuelve `SESSION_RANDOM`; 1 ⇒ nunca hay callback. */
  let randomValue = 1;

  interface ReadyUserOptions {
    readonly level?: 'A2' | 'B1' | 'B2';
    readonly sessionsCount?: number;
    readonly withCredential?: boolean;
    readonly onboarded?: boolean;
  }

  /** Usuario registrado + perfil onboarded + credencial de OpenRouter cifrada. */
  async function newReadyUser(
    namePrefix: string,
    options: ReadyUserOptions = {},
  ): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);

    await seedProfile(admin, user.id, {
      displayName: namePrefix,
      level: options.level ?? 'B1',
      sessionsCount: options.sessionsCount ?? 0,
      onboardedAt: options.onboarded === false ? null : undefined,
    });

    if (options.withCredential !== false) {
      // La cifra con la clave maestra de `.env.test`; nunca es una key real.
      await app.get(CredentialsService).saveApiKey(user.id, 'openrouter', 'clave-falsa');
    }

    return user;
  }

  async function seedNewsItem(dayOffsetDays = 0): Promise<string> {
    const day = new Date(Date.now() - dayOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await admin.database
      .from('news_items')
      .insert({
        source: 'E2E Feed',
        url: `https://example.test/e2e/${randomUUID()}`,
        title: 'Solar power overtakes coal in Europe',
        summary: 'Solar generation beat coal for the first time across the continent.',
        tags: ['science'],
        published_at: new Date().toISOString(),
        day,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`No se pudo sembrar la noticia de prueba: ${error?.message}`);
    }
    const id = (data as { id: string }).id;
    seededNewsIds.push(id);
    return id;
  }

  async function seedConfirmedFact(userId: string, text: string): Promise<string> {
    const { data, error } = await admin.database
      .from('facts')
      .insert({ user_id: userId, text, status: 'confirmed' })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`No se pudo sembrar el hecho de prueba: ${error?.message}`);
    }
    const id = (data as { id: string }).id;
    seededFactIds.push(id);
    return id;
  }

  async function readSession(sessionId: string): Promise<Record<string, unknown>> {
    const { data, error } = await admin.database
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      throw new Error(`No se pudo leer la sesión ${sessionId}: ${error?.message}`);
    }
    return data as Record<string, unknown>;
  }

  async function readTurns(sessionId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await admin.database
      .from('turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('idx', { ascending: true });

    if (error) {
      throw new Error(`No se pudieron leer los turnos de ${sessionId}: ${error.message}`);
    }
    return (data ?? []) as Record<string, unknown>[];
  }

  /** Abre una sesión y registra su id para la limpieza. */
  async function openSession(
    user: E2eTestUser,
    body: Record<string, unknown>,
    expectedStatus = 201,
  ): Promise<request.Response> {
    const response = await request(app.getHttpServer())
      .post('/v1/sessions')
      .set(authHeader(user.accessToken))
      .send(body)
      .expect(expectedStatus);

    const sessionId = response.body?.session?.id;
    if (typeof sessionId === 'string') {
      seededSessionIds.push(sessionId);
    }
    return response;
  }

  /**
   * Grupo de 3 con un desafío real para el primero (MAL-19): el `challenger`
   * cerró una sesión con XP hace 1 día —así aparece en `GET /challenges`— y el
   * `bystander` no tiene ninguna, así que nombrarlo debe dar 422.
   *
   * El `requester` necesita además credencial de proveedor para poder abrir
   * sesión; `seedGroupWithMembers` solo siembra perfiles.
   */
  async function seedChallenge(namePrefix: string): Promise<{
    requester: E2eTestUser;
    challenger: E2eTestUser;
    bystander: E2eTestUser;
    topic: string;
  }> {
    const group = await seedGroupWithMembers(admin, credentials!, {
      memberCount: 3,
      namePrefix,
    });
    const [requester, challenger, bystander] = group.members as [
      SeededMember,
      SeededMember,
      SeededMember,
    ];
    for (const member of group.members) {
      seededUserIds.push(member.user.id);
    }

    await app
      .get(CredentialsService)
      .saveApiKey(requester.user.id, 'openrouter', 'clave-falsa');

    const topic = `Desafio ${randomUUID().slice(0, 8)}`;
    seededSessionIds.push(
      await seedSession(admin, {
        userId: challenger.user.id,
        topic,
        kind: 'free_topic',
        xpEarned: 60,
        endedDaysAgo: 1,
      }),
    );

    return {
      requester: requester.user,
      challenger: challenger.user,
      bystander: bystander.user,
      topic,
    };
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue(fakeLlmService())
      .overrideProvider(SESSION_RANDOM)
      .useValue(() => randomValue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    // `turns` cae en cascada con su sesión; `facts` y `news_items` referenciadas
    // por una sesión usan ON DELETE SET NULL, así que las sesiones van primero.
    for (const sessionId of seededSessionIds) {
      await admin.database.from('sessions').delete().eq('id', sessionId);
    }
    for (const factId of seededFactIds) {
      await admin.database.from('facts').delete().eq('id', factId);
    }
    for (const newsId of seededNewsIds) {
      await admin.database.from('news_items').delete().eq('id', newsId);
    }
    for (const userId of seededUserIds) {
      await admin.database.from('sessions').delete().eq('user_id', userId);
      await admin.database.from('facts').delete().eq('user_id', userId);
      await admin.database.from('provider_credentials').delete().eq('user_id', userId);
    }
    await cleanupE2eData(admin, { userIds: seededUserIds });
    await app.close();
  }, 60_000);

  beforeEach(() => {
    randomValue = 1;
  });

  it('POST /v1/sessions con kind=free_topic crea la sesión activa y el turno 0 del tutor', async () => {
    const user = await newReadyUser('S free');

    const response = await openSession(user, { kind: 'free_topic', topic: 'Mis vacaciones' });

    expect(response.body.session).toMatchObject({
      kind: 'free_topic',
      topic: 'Mis vacaciones',
      endedAt: null,
      xpEarned: 0,
      modelUsed: FAKE_MODEL,
    });
    expect(typeof response.body.session.startedAt).toBe('string');
    expect(response.body.opening).toEqual({ text: FAKE_REPLY, callbackUsed: false });

    const row = await readSession(response.body.session.id);
    expect(row.status).toBe('active');
    expect(row.chat_model_used).toBe(FAKE_MODEL);
    expect(row.turns_count).toBe(0);
    expect(row.news_item_id).toBeNull();

    const turns = await readTurns(response.body.session.id);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ idx: 0, role: 'tutor', text: FAKE_REPLY, model: FAKE_MODEL });
  }, 60_000);

  it('POST /v1/sessions con kind=roleplay guarda el título del escenario como topic', async () => {
    const user = await newReadyUser('S role');

    const response = await openSession(user, { kind: 'roleplay', roleplayId: ROLEPLAY.id });

    expect(response.body.session).toMatchObject({
      kind: 'roleplay',
      topic: ROLEPLAY.title_es,
    });
  }, 60_000);

  it('POST /v1/sessions con kind=news guarda el título y el news_item_id', async () => {
    const user = await newReadyUser('S news');
    const newsItemId = await seedNewsItem();

    const response = await openSession(user, { kind: 'news', newsItemId });

    expect(response.body.session.kind).toBe('news');

    const row = await readSession(response.body.session.id);
    expect(row.news_item_id).toBe(newsItemId);
    expect(row.topic).toBe('Solar power overtakes coal in Europe');
  }, 60_000);

  it('POST /v1/sessions con kind=news y una noticia de hace 20 días → 400 VALIDATION', async () => {
    const user = await newReadyUser('S old news');
    const newsItemId = await seedNewsItem(20);

    const response = await openSession(user, { kind: 'news', newsItemId }, 400);

    expect(response.body.error).toBe('VALIDATION');
  }, 60_000);

  it('POST /v1/sessions con kind=boss toma un tema de BOSS_TOPICS', async () => {
    const user = await newReadyUser('S boss', { level: 'B1', sessionsCount: 6 });

    const response = await openSession(user, { kind: 'boss' });

    expect(response.body.session).toMatchObject({
      kind: 'boss',
      topic: B1_BOSS_TOPIC.title_es,
    });
  }, 60_000);

  it('una segunda sesión con otra activa → 409 SESSION_ALREADY_ACTIVE con activeSessionId', async () => {
    const user = await newReadyUser('S dup');

    const first = await openSession(user, { kind: 'free_topic', topic: 'Primera' });
    const second = await openSession(user, { kind: 'free_topic', topic: 'Segunda' }, 409);

    expect(second.body).toMatchObject({
      error: 'SESSION_ALREADY_ACTIVE',
      statusCode: 409,
      activeSessionId: first.body.session.id,
    });
  }, 60_000);

  it('el callback usado se refleja en sessions.callback_fact_id y en facts.last_used_at', async () => {
    const user = await newReadyUser('S callback');
    const factId = await seedConfirmedFact(user.id, 'She is moving to Lisbon in December');

    randomValue = 0; // siempre por debajo de CALLBACK_PROBABILITY
    const response = await openSession(user, { kind: 'free_topic', topic: 'Mudanzas' });

    expect(response.body.opening.callbackUsed).toBe(true);

    const row = await readSession(response.body.session.id);
    expect(row.callback_fact_id).toBe(factId);

    const { data } = await admin.database
      .from('facts')
      .select('last_used_at, use_count')
      .eq('id', factId)
      .single();
    expect((data as { last_used_at: string | null }).last_used_at).not.toBeNull();
    expect((data as { use_count: number }).use_count).toBe(1);
  }, 60_000);

  it('sin credencial activa → 409 PROVIDER_NOT_CONNECTED', async () => {
    const user = await newReadyUser('S nocred', { withCredential: false });

    const response = await openSession(
      user,
      { kind: 'free_topic', topic: 'Sin proveedor' },
      409,
    );

    expect(response.body).toMatchObject({
      error: 'PROVIDER_NOT_CONNECTED',
      statusCode: 409,
    });
  }, 60_000);

  it('challengeFromUserId de un desafío realmente ofrecido → 201 y se persiste (MAL-19)', async () => {
    const { requester, challenger, topic } = await seedChallenge('S chal ok');

    const response = await openSession(requester, {
      kind: 'free_topic',
      topic,
      challengeFromUserId: challenger.id,
    });

    const row = await readSession(response.body.session.id);
    expect(row.challenge_from_user_id).toBe(challenger.id);
  }, 90_000);

  it('challengeFromUserId de un compañero sin desafío → 422 CHALLENGE_NOT_AVAILABLE (MAL-19)', async () => {
    const { requester, bystander, topic } = await seedChallenge('S chal no');

    const response = await openSession(
      requester,
      { kind: 'free_topic', topic, challengeFromUserId: bystander.id },
      422,
    );

    expect(response.body).toMatchObject({
      error: 'CHALLENGE_NOT_AVAILABLE',
      statusCode: 422,
    });
  }, 90_000);

  it('challengeFromUserId correcto pero con otro tema → 422 (MAL-19)', async () => {
    const { requester, challenger } = await seedChallenge('S chal tema');

    const response = await openSession(
      requester,
      { kind: 'free_topic', topic: 'Un tema distinto', challengeFromUserId: challenger.id },
      422,
    );

    expect(response.body).toMatchObject({ error: 'CHALLENGE_NOT_AVAILABLE' });
  }, 90_000);

  it('perfil sin onboarded_at → 409 NOT_ONBOARDED', async () => {
    const user = await newReadyUser('S noonb', { onboarded: false });

    const response = await openSession(user, { kind: 'free_topic', topic: 'Sin perfil' }, 409);

    expect(response.body).toMatchObject({ error: 'NOT_ONBOARDED', statusCode: 409 });
  }, 60_000);
});
