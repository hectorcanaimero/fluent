import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';
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
  cleanupFixtureData,
  seedCorrection,
  seedGroupWithMembers,
  seedProfile,
  seedSession,
  seedWeeklySummary,
  seedXpEvent,
  type SeededMember,
} from './fixtures.js';
import { resolveWeekStart } from '../src/common/iso-week.js';

/**
 * e2e de PR-02/T7 (progreso, leaderboard, desafíos y resumen semanal)
 * contra la rama real de InsForge `feat-api` (docs/tasks/PR-02-auth-y-api.md,
 * criterio de aceptación de T7: «e2e con datos sembrados por un script de
 * fixtures»). Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` /
 * `INSFORGE_ANON_KEY` en `process.env` o en el archivo gitignored
 * `apps/api/.env.test.local`; si no están, se salta entero (el CI no tiene
 * acceso a InsForge). Sigue el mismo patrón que
 * `apps/api/test/profiles-groups.e2e-spec.ts`/`memory.e2e-spec.ts`.
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de progreso/leaderboard/desafíos/resumen (docs/tasks/PR-02-auth-y-api.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

maybeDescribe('Progreso, leaderboard, desafíos y resumen semanal (e2e, InsForge feat-api)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];
  const seededGroupIds: string[] = [];
  const seededSessionIds: string[] = [];

  const thisWeekStart = resolveWeekStart(undefined, new Date()) as string;

  async function newUser(namePrefix: string): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    return user;
  }

  async function newGroup(memberCount: number, namePrefix: string) {
    const group = await seedGroupWithMembers(admin, credentials!, { memberCount, namePrefix });
    seededGroupIds.push(group.groupId);
    for (const member of group.members) {
      seededUserIds.push(member.user.id);
    }
    return group;
  }

  async function newSession(params: Parameters<typeof seedSession>[1]): Promise<string> {
    const id = await seedSession(admin, params);
    seededSessionIds.push(id);
    return id;
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await cleanupFixtureData(admin, { sessionIds: seededSessionIds, groupIds: seededGroupIds });
    await cleanupE2eData(admin, { userIds: seededUserIds, groupIds: seededGroupIds });
    await app.close();
  }, 30_000);

  describe('GET /v1/progress', () => {
    it(
      'devuelve el nivel correcto, sessionsThisWeek y correctionsTrend con los conteos esperados',
      async () => {
        const user = await newUser('Progress');
        await seedProfile(admin, user.id, {
          displayName: 'Progress User',
          xp: 1600, // Storyteller (min 1500, next 3500)
          streak: 4,
          longestStreak: 10,
        });

        // 2 sesiones válidas de esta semana (ended hace 0 días = "ahora", sin
        // ambigüedad de en qué semana caen) + 1 sesión válida de hace 9 días
        // (fuera de la semana en curso con cualquier "hoy" posible).
        await newSession({ userId: user.id, topic: 'travel', xpEarned: 60, endedDaysAgo: 0 });
        await newSession({ userId: user.id, topic: 'movies', xpEarned: 60, endedDaysAgo: 0 });
        const oldSessionId = await newSession({
          userId: user.id,
          topic: 'sports',
          xpEarned: 60,
          endedDaysAgo: 9,
        });

        // correctionsTrend: 2 de 'articles' dentro de 7d, 1 de 'articles'
        // dentro de 30d (no 7d), 1 de 'word_order' dentro de 7d.
        await seedCorrection(admin, {
          sessionId: oldSessionId,
          userId: user.id,
          category: 'articles',
          daysAgo: 1,
        });
        await seedCorrection(admin, {
          sessionId: oldSessionId,
          userId: user.id,
          category: 'articles',
          daysAgo: 3,
        });
        await seedCorrection(admin, {
          sessionId: oldSessionId,
          userId: user.id,
          category: 'articles',
          daysAgo: 20,
        });
        await seedCorrection(admin, {
          sessionId: oldSessionId,
          userId: user.id,
          category: 'word_order',
          daysAgo: 2,
        });

        const response = await request(app.getHttpServer())
          .get('/v1/progress')
          .set(authHeader(user.accessToken))
          .expect(200);

        expect(response.body.xp).toBe(1600);
        expect(response.body.streak).toBe(4);
        expect(response.body.longestStreak).toBe(10);
        expect(response.body.level).toEqual({ name: 'Storyteller', min: 1500, next: 3500 });
        expect(response.body.sessionsThisWeek).toBe(2);

        const articles = response.body.correctionsTrend.find(
          (t: { category: string }) => t.category === 'articles',
        );
        const wordOrder = response.body.correctionsTrend.find(
          (t: { category: string }) => t.category === 'word_order',
        );
        expect(articles).toEqual({ category: 'articles', count30d: 3, count7d: 2 });
        expect(wordOrder).toEqual({ category: 'word_order', count30d: 1, count7d: 1 });
      },
      30_000,
    );

    it('funciona para un usuario sin grupo (no exige onboarding, a diferencia de leaderboard/challenges/weekly-summary)', async () => {
      const user = await newUser('Progress Sin Grupo');

      const response = await request(app.getHttpServer())
        .get('/v1/progress')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual({
        xp: 0,
        level: { name: 'Newcomer', min: 0, next: 500 },
        streak: 0,
        longestStreak: 0,
        sessionsThisWeek: 0,
        correctionsTrend: [],
      });
    });
  });

  describe('GET /v1/leaderboard', () => {
    it('devuelve las filas ordenadas por xp de la semana, con streak por miembro y groupStreak del grupo', async () => {
      const group = await newGroup(3, 'Leaderboard');
      const [m0, m1, m2] = group.members as [SeededMember, SeededMember, SeededMember];

      const groupStreakUpdate = await admin.database
        .from('groups')
        .update({ group_streak: 5 })
        .eq('id', group.groupId);
      expect(groupStreakUpdate.error).toBeNull();
      const m0StreakUpdate = await admin.database
        .from('profiles')
        .update({ streak: 3 })
        .eq('user_id', m0.user.id);
      expect(m0StreakUpdate.error).toBeNull();
      const m1StreakUpdate = await admin.database
        .from('profiles')
        .update({ streak: 7 })
        .eq('user_id', m1.user.id);
      expect(m1StreakUpdate.error).toBeNull();

      const session0 = await newSession({ userId: m0.user.id, topic: 'travel', xpEarned: 60, endedDaysAgo: 0 });
      const session1 = await newSession({ userId: m1.user.id, topic: 'movies', xpEarned: 60, endedDaysAgo: 0 });
      await seedXpEvent(admin, { userId: m0.user.id, sessionId: session0, kind: 'session', amount: 150 });
      await seedXpEvent(admin, { userId: m1.user.id, sessionId: session1, kind: 'session', amount: 100 });
      // m2 no juega esta semana: debe aparecer igual, con xp 0 y sessions 0.

      const response = await request(app.getHttpServer())
        .get('/v1/leaderboard')
        .set(authHeader(m0.user.accessToken))
        .expect(200);

      expect(response.body.weekStart).toBe(thisWeekStart);
      expect(response.body.groupStreak).toBe(5);
      expect(response.body.rows).toEqual([
        { userId: m0.user.id, displayName: m0.displayName, xpWeek: 150, sessionsWeek: 1, streak: 3 },
        { userId: m1.user.id, displayName: m1.displayName, xpWeek: 100, sessionsWeek: 1, streak: 7 },
        { userId: m2.user.id, displayName: m2.displayName, xpWeek: 0, sessionsWeek: 0, streak: 0 },
      ]);
    });

    it('?week= con formato inválido -> 400 VALIDATION', async () => {
      const group = await newGroup(1, 'Leaderboard Invalid Week');
      const [m0] = group.members;

      const response = await request(app.getHttpServer())
        .get('/v1/leaderboard')
        .query({ week: 'not-a-date' })
        .set(authHeader(m0.user.accessToken))
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });
    });

    it('usuario sin grupo -> 409 NOT_ONBOARDED', async () => {
      const user = await newUser('Leaderboard Sin Grupo');

      const response = await request(app.getHttpServer())
        .get('/v1/leaderboard')
        .set(authHeader(user.accessToken))
        .expect(409);

      expect(response.body).toMatchObject({ error: 'NOT_ONBOARDED', statusCode: 409 });
    });
  });

  describe('GET /v1/challenges', () => {
    it('aplica las reglas de SPEC-07 §7: máximo 3, uno por miembro, excluye temas practicados en 14 días, sesiones propias, sin XP y de más de 7 días', async () => {
      const group = await newGroup(5, 'Challenges');
      const [requester, eligible, noXp, tooOld, practicedTopic] = group.members as [
        SeededMember,
        SeededMember,
        SeededMember,
        SeededMember,
        SeededMember,
      ];

      // El propio usuario practicó "grammar" hace 2 días: cualquier candidato
      // con ese tema debe quedar excluido.
      await newSession({ userId: requester.user.id, topic: 'grammar', xpEarned: 60, endedDaysAgo: 2 });

      const eligibleSessionId = await newSession({
        userId: eligible.user.id,
        topic: 'philosophy',
        kind: 'boss',
        xpEarned: 60,
        endedDaysAgo: 1,
      });
      // Sin XP: no es una sesión "válida".
      await newSession({ userId: noXp.user.id, topic: 'sports', xpEarned: 0, endedDaysAgo: 1 });
      // Terminada hace más de 7 días.
      await newSession({ userId: tooOld.user.id, topic: 'history', xpEarned: 60, endedDaysAgo: 10 });
      // Mismo tema que ya practicó el usuario que pide /challenges.
      await newSession({ userId: practicedTopic.user.id, topic: 'grammar', xpEarned: 60, endedDaysAgo: 1 });

      const response = await request(app.getHttpServer())
        .get('/v1/challenges')
        .set(authHeader(requester.user.accessToken))
        .expect(200);

      expect(response.body.items).toEqual([
        {
          fromUserId: eligible.user.id,
          displayName: eligible.displayName,
          topic: 'philosophy',
          kind: 'boss',
          sessionId: eligibleSessionId,
        },
      ]);
    });

    it('usuario sin grupo -> 409 NOT_ONBOARDED', async () => {
      const user = await newUser('Challenges Sin Grupo');

      const response = await request(app.getHttpServer())
        .get('/v1/challenges')
        .set(authHeader(user.accessToken))
        .expect(409);

      expect(response.body).toMatchObject({ error: 'NOT_ONBOARDED', statusCode: 409 });
    });
  });

  describe('GET /v1/weekly-summary', () => {
    it('con un weekly_summaries sembrado para esa semana -> 200 {text, weekStart}', async () => {
      const group = await newGroup(1, 'Weekly Summary Ready');
      const [m0] = group.members;

      await seedWeeklySummary(admin, {
        groupId: group.groupId,
        weekStart: thisWeekStart,
        text: '¡Buena semana practicando!',
      });

      const response = await request(app.getHttpServer())
        .get('/v1/weekly-summary')
        .set(authHeader(m0.user.accessToken))
        .expect(200);

      expect(response.body).toEqual({ text: '¡Buena semana practicando!', weekStart: thisWeekStart });
    });

    it('sin weekly_summaries para esa semana -> 404 NOT_READY', async () => {
      const group = await newGroup(1, 'Weekly Summary Not Ready');
      const [m0] = group.members;

      const response = await request(app.getHttpServer())
        .get('/v1/weekly-summary')
        .set(authHeader(m0.user.accessToken))
        .expect(404);

      expect(response.body).toMatchObject({ error: 'NOT_READY', statusCode: 404 });
    });

    it('usuario sin grupo -> 409 NOT_ONBOARDED', async () => {
      const user = await newUser('Weekly Summary Sin Grupo');

      const response = await request(app.getHttpServer())
        .get('/v1/weekly-summary')
        .set(authHeader(user.accessToken))
        .expect(409);

      expect(response.body).toMatchObject({ error: 'NOT_ONBOARDED', statusCode: 409 });
    });
  });
});
