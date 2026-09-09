import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';

import { ROLEPLAYS } from '../src/content/index.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../src/jobs/job-dispatcher.js';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  loadInsforgeE2eCredentials,
  registerE2eUser,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';
import { seedProfile, seedSession, seedCorrection } from './fixtures.js';

/**
 * e2e de PR-04/T3: `POST /sessions/:id/end` (SPEC-04 §5), `GET
 * /sessions/suggestions` (SPEC-04 §7), `GET /sessions` y `GET /sessions/:id`
 * (SPEC-02 §4.3), contra la rama real de InsForge.
 *
 * **Archivo nuevo** (mismo criterio que `session-turns.e2e-spec.ts`, PEND-34
 * de docs/specs/pendientes/PR-04.md): T3 no necesita `LlmService` simulado
 * (ninguno de sus tres servicios llama al LLM) ni un doble de Redis (no usan
 * locks ni ritmo), así que mezclarlo con `sessions.e2e-spec.ts` (que sí monta
 * las dos cosas) solo añadiría peso al `beforeAll`. Sí sustituye
 * `JOB_DISPATCHER` por un doble que registra las llamadas, para comprobar el
 * encolado condicional del brief sin BullMQ ni Redis (SPEC-05 §1).
 *
 * Las sesiones que necesitan una `duration_sec` concreta se siembran
 * directamente con el cliente admin (`seedSession`, con `startedAt` en el
 * pasado) en vez de abrirlas por `POST /sessions`: así `duration_sec = now -
 * started_at` da un valor predecible sin esperar minutos reales en el test.
 *
 * Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` / `INSFORGE_ANON_KEY` en
 * `process.env` o en el archivo gitignored `apps/api/.env.test.local`; si no
 * están, se salta entero.
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de cierre y sugerencias de sesión (docs/tasks/PR-04-sesion.md, T3).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

maybeDescribe('Cierre y sugerencias de sesión (e2e, InsForge)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];
  const seededSessionIds: string[] = [];

  /** Llamadas que recibió el doble de `JobDispatcher`, en orden. */
  let enqueuedBriefs: string[] = [];
  const fakeJobDispatcher: JobDispatcher = {
    enqueueCoachingBrief: async (sessionId: string) => {
      enqueuedBriefs.push(sessionId);
    },
  };

  interface ReadyUserOptions {
    readonly interests?: string[];
    readonly sessionsCount?: number;
  }

  async function newReadyUser(
    namePrefix: string,
    options: ReadyUserOptions = {},
  ): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    await seedProfile(admin, user.id, {
      displayName: namePrefix,
      level: 'B1',
      interests: options.interests,
      sessionsCount: options.sessionsCount ?? 0,
    });
    return user;
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

  /** Sesión `active` con `started_at` hace `secondsAgo` segundos, lista para `POST /end`. */
  async function seedActiveSession(
    userId: string,
    secondsAgo: number,
    turnsCount: number,
  ): Promise<string> {
    const id = await seedSession(admin, {
      userId,
      topic: 'Tema de prueba',
      status: 'active',
      turnsCount,
      startedAt: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    });
    seededSessionIds.push(id);
    return id;
  }

  function postEnd(user: E2eTestUser, sessionId: string, reason: 'timer' | 'user' = 'user') {
    return request(app.getHttpServer())
      .post(`/v1/sessions/${sessionId}/end`)
      .set(authHeader(user.accessToken))
      .send({ reason });
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JOB_DISPATCHER)
      .useValue(fakeJobDispatcher)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    for (const sessionId of seededSessionIds) {
      await admin.database.from('corrections').delete().eq('session_id', sessionId);
      await admin.database.from('sessions').delete().eq('id', sessionId);
    }
    for (const userId of seededUserIds) {
      await admin.database.from('corrections').delete().eq('user_id', userId);
      await admin.database.from('sessions').delete().eq('user_id', userId);
    }
    await cleanupE2eData(admin, { userIds: seededUserIds });
    await app.close();
  }, 60_000);

  beforeEach(() => {
    enqueuedBriefs = [];
  });

  // ---------------------------------------------------------------------
  // POST /sessions/:id/end
  // ---------------------------------------------------------------------

  it('cierra una sesión activa con el XP correcto según SPEC-07 §2 (perfil sin sesiones previas)', async () => {
    const user = await newReadyUser('End xp');
    // 650 s ≈ 10-11 min: floor(650/60)=10 → duración=(10-5)*6=30 (tope), sin
    // cruzar el minuto 12 aunque el test tarde unos segundos en ejecutarse.
    const sessionId = await seedActiveSession(user.id, 650, 4);
    await seedCorrection(admin, { sessionId, userId: user.id, category: 'past_simple' });
    await seedCorrection(admin, { sessionId, userId: user.id, category: 'articles' });

    const response = await postEnd(user, sessionId).expect(200);

    // XP_SESSION_BASE (50) + duración tope (30) = 80; primera sesión válida
    // del día → sin bono de doble sesión; streak arranca en 1.
    expect(response.body.summary).toMatchObject({
      xpEarned: 80,
      streak: 1,
      isDoubleDay: false,
      correctionsCount: 2,
      nextIsBoss: false,
    });
    expect(response.body.summary.durationSec).toBeGreaterThanOrEqual(600);
    expect(response.body.summary.durationSec).toBeLessThan(720);

    const row = await readSession(sessionId);
    expect(row.status).toBe('ended');
    expect(row.xp_earned).toBe(80);
    expect(row.turns_count).toBe(4);

    // turns_count (4) >= MIN_TURNS_FOR_BRIEF (3): se encoló el brief y
    // brief_job_status se queda en su valor por defecto ('pending').
    expect(enqueuedBriefs).toEqual([sessionId]);
    expect(row.brief_job_status).toBe('pending');
  }, 60_000);

  it('sesión con menos de 2 turnos: se cierra sin XP y sin encolar coaching-brief', async () => {
    const user = await newReadyUser('End short');
    const sessionId = await seedActiveSession(user.id, 600, 1);

    const response = await postEnd(user, sessionId).expect(200);

    expect(response.body.summary.xpEarned).toBe(0);
    expect(response.body.summary.correctionsCount).toBe(0);

    const row = await readSession(sessionId);
    expect(row.status).toBe('ended');
    expect(row.xp_earned).toBe(0);

    // turns_count (1) < MIN_TURNS_FOR_BRIEF (3): no se encola nada y queda 'done'.
    expect(enqueuedBriefs).toEqual([]);
    expect(row.brief_job_status).toBe('done');
  }, 60_000);

  it('cerrar dos veces la misma sesión responde 200 las dos veces con el mismo resumen, sin volver a encolar', async () => {
    const user = await newReadyUser('End twice');
    const sessionId = await seedActiveSession(user.id, 650, 4);

    const first = await postEnd(user, sessionId).expect(200);
    const second = await postEnd(user, sessionId).expect(200);

    expect(second.body.summary.xpEarned).toBe(first.body.summary.xpEarned);
    expect(second.body.summary.streak).toBe(first.body.summary.streak);
    // Solo se encoló una vez, en el primer cierre.
    expect(enqueuedBriefs).toEqual([sessionId]);
  }, 60_000);

  it('sesión de otro usuario → 403 FORBIDDEN', async () => {
    const owner = await newReadyUser('End owner');
    const stranger = await newReadyUser('End stranger');
    const sessionId = await seedActiveSession(owner.id, 600, 4);

    const response = await postEnd(stranger, sessionId).expect(403);
    expect(response.body).toMatchObject({ error: 'FORBIDDEN', statusCode: 403 });
  }, 60_000);

  it('sesión inexistente → 403 FORBIDDEN (no se filtra qué sesiones existen)', async () => {
    const user = await newReadyUser('End missing');
    const response = await postEnd(user, randomUUID()).expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  }, 60_000);

  it('cuerpo inválido (`reason` fuera de catálogo) → 400 VALIDATION', async () => {
    const user = await newReadyUser('End bad reason');
    const sessionId = await seedActiveSession(user.id, 600, 4);

    const response = await request(app.getHttpServer())
      .post(`/v1/sessions/${sessionId}/end`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'porque-si' })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION');
  }, 60_000);

  // ---------------------------------------------------------------------
  // GET /sessions/suggestions
  // ---------------------------------------------------------------------

  it('GET /v1/sessions/suggestions no se confunde con GET /v1/sessions/:id (orden de rutas)', async () => {
    const user = await newReadyUser('Order');

    const response = await request(app.getHttpServer())
      .get('/v1/sessions/suggestions')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body).toHaveProperty('topics');
    expect(response.body).toHaveProperty('roleplays');
    expect(response.body).toHaveProperty('news');
    expect(response.body).toHaveProperty('bossPending');
    expect(Array.isArray(response.body.topics)).toBe(true);
    expect(response.body.topics).toHaveLength(8);
    expect(response.body.roleplays.length).toBeLessThanOrEqual(4);
    expect(typeof response.body.bossPending).toBe('boolean');
  }, 60_000);

  it('las sugerencias de tema respetan los intereses del perfil', async () => {
    // 'technology' → tags ['tech','coding','automation'] en INTERESTS.
    const user = await newReadyUser('Interests', { interests: ['technology'] });

    const response = await request(app.getHttpServer())
      .get('/v1/sessions/suggestions')
      .set(authHeader(user.accessToken))
      .expect(200);

    const { TOPICS } = await import('../src/content/index.js');
    const techTitles = new Set(
      TOPICS.filter((t) => t.tags.some((tag) => ['tech', 'coding', 'automation'].includes(tag))).map(
        (t) => t.title_es,
      ),
    );
    const matchingCount = (response.body.topics as string[]).filter((title) =>
      techTitles.has(title),
    ).length;
    // Al menos algunas de las 8 deberían casar con "technology" (hasta 6).
    expect(matchingCount).toBeGreaterThan(0);
  }, 60_000);

  it('las sugerencias de roleplay excluyen los usados en las últimas 5 sesiones', async () => {
    const user = await newReadyUser('Recent roleplay');
    const recentRoleplay = ROLEPLAYS.find((r) => r.level_min !== 'B2');
    if (!recentRoleplay) {
      throw new Error('El catálogo de test necesita un roleplay con level_min A2 o B1.');
    }

    const sessionId = await seedSession(admin, {
      userId: user.id,
      topic: recentRoleplay.title_es,
      kind: 'roleplay',
      status: 'ended',
      endedDaysAgo: 0,
    });
    seededSessionIds.push(sessionId);

    const response = await request(app.getHttpServer())
      .get('/v1/sessions/suggestions')
      .set(authHeader(user.accessToken))
      .expect(200);

    const titles = (response.body.roleplays as Array<{ title: string }>).map((r) => r.title);
    // Solo se garantiza la exclusión si el catálogo tiene alternativas de
    // sobra en el nivel del usuario (documentado: si no, se completa
    // repitiendo el reciente antes que devolver menos de 4).
    const alternatives = ROLEPLAYS.filter(
      (r) => r.level_min !== 'B2' && r.title_es !== recentRoleplay.title_es,
    );
    if (alternatives.length >= 4) {
      expect(titles).not.toContain(recentRoleplay.title_es);
    }
  }, 60_000);

  it('perfil sin onboarded_at → 409 NOT_ONBOARDED', async () => {
    const user = await registerE2eUser(credentials!, 'Suggest noonb');
    seededUserIds.push(user.id);
    await seedProfile(admin, user.id, { displayName: 'Suggest noonb', onboardedAt: null });

    const response = await request(app.getHttpServer())
      .get('/v1/sessions/suggestions')
      .set(authHeader(user.accessToken))
      .expect(409);

    expect(response.body.error).toBe('NOT_ONBOARDED');
  }, 60_000);

  // ---------------------------------------------------------------------
  // GET /sessions y GET /sessions/:id
  // ---------------------------------------------------------------------

  it('GET /v1/sessions lista las sesiones del usuario, más recientes primero, con paginación por cursor', async () => {
    const user = await newReadyUser('List');
    const first = await seedSession(admin, {
      userId: user.id,
      topic: 'Primera',
      endedDaysAgo: 3,
    });
    const second = await seedSession(admin, {
      userId: user.id,
      topic: 'Segunda',
      endedDaysAgo: 2,
    });
    const third = await seedSession(admin, {
      userId: user.id,
      topic: 'Tercera',
      endedDaysAgo: 1,
    });
    seededSessionIds.push(first, second, third);

    const page1 = await request(app.getHttpServer())
      .get('/v1/sessions')
      .query({ limit: 2 })
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].topic).toBe('Tercera');
    expect(page1.body.items[1].topic).toBe('Segunda');
    expect(typeof page1.body.nextCursor).toBe('string');

    const page2 = await request(app.getHttpServer())
      .get('/v1/sessions')
      .query({ limit: 2, cursor: page1.body.nextCursor })
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].topic).toBe('Primera');
    expect(page2.body.nextCursor).toBeNull();
  }, 60_000);

  it('GET /v1/sessions con un `cursor` corrupto → 400 VALIDATION', async () => {
    const user = await newReadyUser('List bad cursor');

    const response = await request(app.getHttpServer())
      .get('/v1/sessions')
      .query({ cursor: 'esto-no-es-un-cursor-valido' })
      .set(authHeader(user.accessToken))
      .expect(400);

    expect(response.body.error).toBe('VALIDATION');
  }, 60_000);

  it('GET /v1/sessions/:id devuelve la sesión con sus turnos y correcciones', async () => {
    const user = await newReadyUser('Detail');
    const sessionId = await seedSession(admin, { userId: user.id, topic: 'Con turnos' });
    seededSessionIds.push(sessionId);

    await admin.database.from('turns').insert([
      { session_id: sessionId, idx: 0, role: 'tutor', text: 'Hi there!' },
      { session_id: sessionId, idx: 1, role: 'user', text: 'I go to Rome yesterday' },
      { session_id: sessionId, idx: 2, role: 'tutor', text: 'Nice, tell me more.' },
    ]);
    await seedCorrection(admin, { sessionId, userId: user.id, category: 'past_simple', turnIdx: 1 });

    const response = await request(app.getHttpServer())
      .get(`/v1/sessions/${sessionId}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body.session.id).toBe(sessionId);
    expect(response.body.turns).toEqual([
      { idx: 0, role: 'tutor', text: 'Hi there!' },
      { idx: 1, role: 'user', text: 'I go to Rome yesterday' },
      { idx: 2, role: 'tutor', text: 'Nice, tell me more.' },
    ]);
    expect(response.body.corrections).toHaveLength(1);
    expect(response.body.corrections[0]).toMatchObject({
      original: 'I go to school yesterday.',
      corrected: 'I went to school yesterday.',
      category: 'past_simple',
    });
  }, 60_000);

  it('GET /v1/sessions/:id de otro usuario → 403 FORBIDDEN', async () => {
    const owner = await newReadyUser('Detail owner');
    const stranger = await newReadyUser('Detail stranger');
    const sessionId = await seedSession(admin, { userId: owner.id, topic: 'Privada' });
    seededSessionIds.push(sessionId);

    const response = await request(app.getHttpServer())
      .get(`/v1/sessions/${sessionId}`)
      .set(authHeader(stranger.accessToken))
      .expect(403);

    expect(response.body.error).toBe('FORBIDDEN');
  }, 60_000);
});
