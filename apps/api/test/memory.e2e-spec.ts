import { randomUUID } from 'node:crypto';
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

/**
 * e2e de PR-02/T6 (memoria: hechos y coaching brief) contra la rama real de
 * InsForge `feat-api` (docs/tasks/PR-02-auth-y-api.md, criterio de
 * aceptación de T6). Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` /
 * `INSFORGE_ANON_KEY` en `process.env` o en el archivo gitignored
 * `apps/api/.env.test.local`; si no están, se salta entero (el CI no tiene
 * acceso a InsForge). Sigue el mismo patrón que
 * `apps/api/test/profiles-groups.e2e-spec.ts`.
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de memoria (docs/tasks/PR-02-auth-y-api.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

maybeDescribe('Memoria: hechos y coaching brief (e2e, InsForge feat-api)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];

  async function newUser(namePrefix: string): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    return user;
  }

  /**
   * Siembra un hecho directamente con el cliente admin: el flujo real lo
   * crea PR-05 (el job de brief tras una sesión), fuera de alcance de T6.
   */
  async function seedFact(
    userId: string,
    overrides: { text?: string; status?: 'pending' | 'confirmed' | 'dismissed' } = {},
  ): Promise<string> {
    const { data, error } = await admin.database
      .from('facts')
      .insert({
        user_id: userId,
        text: overrides.text ?? `E2E fact ${randomUUID().slice(0, 8)}`,
        status: overrides.status ?? 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`No se pudo sembrar el hecho de prueba: ${error?.message}`);
    }
    return (data as { id: string }).id;
  }

  /** Siembra directamente una fila en `coaching_briefs` con el cliente admin. */
  async function seedBrief(userId: string, text: string): Promise<void> {
    const { error } = await admin.database.from('coaching_briefs').insert({
      user_id: userId,
      text,
    });
    if (error) {
      throw new Error(`No se pudo sembrar el brief de prueba: ${error.message}`);
    }
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
    await cleanupE2eData(admin, { userIds: seededUserIds });
    await app.close();
  }, 30_000);

  it(
    'GET /v1/memory devuelve buckets vacíos y un brief por defecto para un usuario sin datos (PEND-40)',
    async () => {
      const user = await newUser('Memory Empty');

      const response = await request(app.getHttpServer())
        .get('/v1/memory')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual({
        facts: { pending: [], confirmed: [] },
        brief: { text: '', levelHint: null, recurringErrors: [], updatedAt: null },
      });
    },
    30_000,
  );

  it(
    'PATCH confirma y descarta hechos; GET /v1/memory los reagrupa y los dismissed desaparecen',
    async () => {
      const user = await newUser('Memory Patch');
      const pendingId = await seedFact(user.id, { text: 'Ana travels to Lisbon in October.' });
      const toDismissId = await seedFact(user.id, { text: 'Ana dislikes seafood.' });

      const confirmResponse = await request(app.getHttpServer())
        .patch(`/v1/memory/facts/${pendingId}`)
        .set(authHeader(user.accessToken))
        .send({ status: 'confirmed' })
        .expect(200);

      expect(confirmResponse.body).toMatchObject({
        id: pendingId,
        status: 'confirmed',
        text: 'Ana travels to Lisbon in October.',
      });
      expect(confirmResponse.body).toHaveProperty('sourceSession');
      expect(confirmResponse.body).toHaveProperty('happensOn');
      expect(confirmResponse.body).toHaveProperty('lastUsedAt');

      const dismissResponse = await request(app.getHttpServer())
        .patch(`/v1/memory/facts/${toDismissId}`)
        .set(authHeader(user.accessToken))
        .send({ status: 'dismissed' })
        .expect(200);

      expect(dismissResponse.body).toMatchObject({ id: toDismissId, status: 'dismissed' });

      const memoryResponse = await request(app.getHttpServer())
        .get('/v1/memory')
        .set(authHeader(user.accessToken))
        .expect(200);

      const pendingIds = memoryResponse.body.facts.pending.map((f: { id: string }) => f.id);
      const confirmedIds = memoryResponse.body.facts.confirmed.map((f: { id: string }) => f.id);
      const allIds = [...pendingIds, ...confirmedIds];

      expect(confirmedIds).toContain(pendingId);
      expect(allIds).not.toContain(toDismissId);
    },
    30_000,
  );

  it('PATCH con solo texto edita el hecho sin tocar su status', async () => {
    const user = await newUser('Memory Patch Text');
    const factId = await seedFact(user.id, { text: 'Original text.', status: 'confirmed' });

    const response = await request(app.getHttpServer())
      .patch(`/v1/memory/facts/${factId}`)
      .set(authHeader(user.accessToken))
      .send({ text: 'Edited text.' })
      .expect(200);

    expect(response.body).toMatchObject({ id: factId, status: 'confirmed', text: 'Edited text.' });
  });

  it('PATCH sin status ni text -> 400 VALIDATION', async () => {
    const user = await newUser('Memory Patch Empty');
    const factId = await seedFact(user.id);

    const response = await request(app.getHttpServer())
      .patch(`/v1/memory/facts/${factId}`)
      .set(authHeader(user.accessToken))
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });
  });

  it(
    'el usuario B no puede tocar los hechos del usuario A: 403/404 en PATCH y DELETE, el hecho de A sigue intacto',
    async () => {
      const userA = await newUser('Memory Owner A');
      const userB = await newUser('Memory Intruder B');
      const factId = await seedFact(userA.id, { text: "A's private fact." });

      const patchResponse = await request(app.getHttpServer())
        .patch(`/v1/memory/facts/${factId}`)
        .set(authHeader(userB.accessToken))
        .send({ status: 'confirmed' });
      expect([403, 404]).toContain(patchResponse.status);

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/v1/memory/facts/${factId}`)
        .set(authHeader(userB.accessToken));
      expect([403, 404]).toContain(deleteResponse.status);

      // El hecho de A sigue intacto: A todavía lo ve, sin cambios.
      const memoryOfA = await request(app.getHttpServer())
        .get('/v1/memory')
        .set(authHeader(userA.accessToken))
        .expect(200);

      const factOfA = [...memoryOfA.body.facts.pending, ...memoryOfA.body.facts.confirmed].find(
        (f: { id: string }) => f.id === factId,
      );
      expect(factOfA).toMatchObject({
        id: factId,
        status: 'pending',
        text: "A's private fact.",
      });
    },
    30_000,
  );

  it('DELETE /v1/memory/facts/:id borra el hecho propio -> 204, y desaparece de GET /v1/memory', async () => {
    const user = await newUser('Memory Delete Fact');
    const factId = await seedFact(user.id);

    await request(app.getHttpServer())
      .delete(`/v1/memory/facts/${factId}`)
      .set(authHeader(user.accessToken))
      .expect(204);

    const response = await request(app.getHttpServer())
      .get('/v1/memory')
      .set(authHeader(user.accessToken))
      .expect(200);

    const allIds = [...response.body.facts.pending, ...response.body.facts.confirmed].map(
      (f: { id: string }) => f.id,
    );
    expect(allIds).not.toContain(factId);
  });

  it('PUT /v1/memory/brief con más de 600 caracteres -> 400 VALIDATION; con 600 -> 200', async () => {
    const user = await newUser('Memory Brief Limits');

    const tooLong = await request(app.getHttpServer())
      .put('/v1/memory/brief')
      .set(authHeader(user.accessToken))
      .send({ text: 'a'.repeat(601) })
      .expect(400);
    expect(tooLong.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });

    const exactly600 = await request(app.getHttpServer())
      .put('/v1/memory/brief')
      .set(authHeader(user.accessToken))
      .send({ text: 'a'.repeat(600) })
      .expect(200);

    expect(exactly600.body.text).toHaveLength(600);
    expect(exactly600.body.levelHint).toBeNull();
    expect(exactly600.body.recurringErrors).toEqual([]);
    expect(typeof exactly600.body.updatedAt).toBe('string');
  });

  it('PUT /v1/memory/brief crea el brief si no existía y lo actualiza si ya existía', async () => {
    const user = await newUser('Memory Brief Upsert');

    const created = await request(app.getHttpServer())
      .put('/v1/memory/brief')
      .set(authHeader(user.accessToken))
      .send({ text: 'First version.' })
      .expect(200);
    expect(created.body.text).toBe('First version.');

    const updated = await request(app.getHttpServer())
      .put('/v1/memory/brief')
      .set(authHeader(user.accessToken))
      .send({ text: 'Second version.' })
      .expect(200);
    expect(updated.body.text).toBe('Second version.');

    const memory = await request(app.getHttpServer())
      .get('/v1/memory')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(memory.body.brief.text).toBe('Second version.');
  });

  it(
    'DELETE /v1/memory borra hechos y brief del usuario: GET /v1/memory queda vacío',
    async () => {
      const user = await newUser('Memory Delete All');
      await seedFact(user.id, { text: 'Fact one.' });
      await seedFact(user.id, { text: 'Fact two.', status: 'confirmed' });
      await seedBrief(user.id, 'Some coaching notes.');

      await request(app.getHttpServer())
        .delete('/v1/memory')
        .set(authHeader(user.accessToken))
        .expect(204);

      const response = await request(app.getHttpServer())
        .get('/v1/memory')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual({
        facts: { pending: [], confirmed: [] },
        brief: { text: '', levelHint: null, recurringErrors: [], updatedAt: null },
      });
    },
    30_000,
  );
});
