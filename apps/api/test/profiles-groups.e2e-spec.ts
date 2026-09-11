import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { InsForgeClient } from '@insforge/sdk';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  createE2eGroup,
  createE2eInvitation,
  loadInsforgeE2eCredentials,
  registerE2eUser,
  type E2eTestUser,
  type InsforgeE2eCredentials,
} from './insforge-e2e.js';
import { INTERESTS } from '../src/content/index.js';

/**
 * e2e de PR-02/T2 (perfil, grupo e invitaciones) contra la rama real de
 * InsForge `feat-api` (docs/tasks/PR-02-auth-y-api.md, criterio de
 * aceptación de T2). Necesita `INSFORGE_URL` / `INSFORGE_API_KEY` /
 * `INSFORGE_ANON_KEY` en `process.env` o en el archivo gitignored
 * `apps/api/.env.test.local`; si no están, se salta entero (el CI no tiene
 * acceso a InsForge).
 */
const credentials: InsforgeE2eCredentials | null = loadInsforgeE2eCredentials();

if (credentials) {
  // Debe ocurrir antes de que Nest instancie ConfigService (dentro de
  // `compile()`, en `beforeAll`): así habla con la rama real en vez de con
  // los valores ficticios de `.env.test`.
  applyInsforgeE2eEnv(credentials);
} else {
  // eslint-disable-next-line no-console -- aviso claro de por qué se saltan los tests, sin fallar el run.
  console.warn(
    '[e2e] Sin credenciales de InsForge (INSFORGE_URL/INSFORGE_API_KEY/INSFORGE_ANON_KEY): ' +
      'se saltan los tests de perfil/grupo/invitaciones (docs/tasks/PR-02-auth-y-api.md).',
  );
}

const maybeDescribe = credentials ? describe : describe.skip;
const VALID_INTERESTS = INTERESTS.slice(0, 3).map((interest) => interest.id);

function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

maybeDescribe('Perfil, grupo e invitaciones (e2e, InsForge feat-api)', () => {
  let app: INestApplication<App>;
  let admin: InsForgeClient;

  const seededUserIds: string[] = [];
  const seededGroupIds: string[] = [];
  const seededInvitationCodes: string[] = [];

  async function newUser(namePrefix: string): Promise<E2eTestUser> {
    const user = await registerE2eUser(credentials!, namePrefix);
    seededUserIds.push(user.id);
    return user;
  }

  async function newGroup(name: string, ownerId?: string): Promise<{ id: string; name: string }> {
    const group = await createE2eGroup(admin, name, ownerId);
    seededGroupIds.push(group.id);
    return group;
  }

  async function newInvitation(groupId: string, createdBy?: string, expiresInMs?: number): Promise<string> {
    const code = await createE2eInvitation(admin, { groupId, createdBy, expiresInMs });
    seededInvitationCodes.push(code);
    return code;
  }

  beforeAll(async () => {
    admin = createE2eAdminClient(credentials!);

    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    // El ValidationPipe global (con el exceptionFactory de PR-02/T3 que
    // produce ApiException con details[]) ya lo aporta CommonModule
    // (APP_PIPE) al importar AppModule; no hace falta (ni conviene, para no
    // duplicar la validación) registrarlo también aquí.
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await cleanupE2eData(admin, {
      userIds: seededUserIds,
      groupIds: seededGroupIds,
      invitationCodes: seededInvitationCodes,
    });
    await app.close();
  }, 30_000);

  it('GET /v1/me sin bearer responde 401 UNAUTHENTICATED con el cuerpo {error, message}', async () => {
    const response = await request(app.getHttpServer()).get('/v1/me').expect(401);

    expect(response.body).toMatchObject({ error: 'UNAUTHENTICATED', statusCode: 401 });
    expect(typeof response.body.message).toBe('string');
  });

  it(
    'flujo completo: registro -> POST /invitations/redeem -> PUT /me/profile -> ' +
      'GET /me devuelve onboarded:true, el grupo y el perfil correctos',
    async () => {
      const owner = await newUser('Owner Flujo');
      const group = await newGroup('Grupo flujo completo', owner.id);
      const code = await newInvitation(group.id, owner.id);

      const member = await newUser('Member Flujo');

      const redeemResponse = await request(app.getHttpServer())
        .post('/v1/invitations/redeem')
        .set(authHeader(member.accessToken))
        .send({ code });

      expect([200, 201]).toContain(redeemResponse.status);
      expect(redeemResponse.body).toEqual({
        group: { id: group.id, name: group.name, groupStreak: 0 },
      });

      const putResponse = await request(app.getHttpServer())
        .put('/v1/me/profile')
        .set(authHeader(member.accessToken))
        .send({
          displayName: 'Miembro E2E',
          level: 'B1',
          interests: VALID_INTERESTS,
          timezone: 'America/Sao_Paulo',
          locale: 'es',
        })
        .expect(200);

      expect(putResponse.body).toEqual({
        displayName: 'Miembro E2E',
        level: 'B1',
        interests: VALID_INTERESTS,
        timezone: 'America/Sao_Paulo',
        locale: 'es',
        xp: 20, // MEJ-14: concedidos al completar el perfil.
        streak: 0,
        lastSessionDay: null,
        // MEJ-14: el PUT devuelve el perfil plano más `xpAwarded`.
        xpAwarded: 20,
      });

      const meResponse = await request(app.getHttpServer())
        .get('/v1/me')
        .set(authHeader(member.accessToken))
        .expect(200);

      expect(meResponse.body.onboarded).toBe(true);
      expect(meResponse.body.group).toEqual({ id: group.id, name: group.name, groupStreak: 0 });
      expect(meResponse.body.profile).toEqual({
        displayName: 'Miembro E2E',
        level: 'B1',
        interests: VALID_INTERESTS,
        timezone: 'America/Sao_Paulo',
        locale: 'es',
        xp: 20, // MEJ-14: concedidos al completar el perfil.
        streak: 0,
        lastSessionDay: null,
      });
      expect(meResponse.body.activeSessionId).toBeNull();
      expect(Array.isArray(meResponse.body.interestsCatalog)).toBe(true);
      expect(meResponse.body.interestsCatalog.length).toBeGreaterThan(0);
      expect(meResponse.body.pendingActions).toEqual([]);
      // Usuario recién creado: ninguna sesión cerrada hoy.
      expect(meResponse.body.sessionsToday).toBe(0);
      // MAL-24: el owner del grupo de prueba no tiene credencial activa, así
      // que no hay cortesía que ofrecer.
      // DEPENDE de la migración `sesion-de-cortesia`, todavía sin aplicar.
      expect(meResponse.body.courtesySessionAvailable).toBe(false);

      // MEJ-14: los 20 XP del PUT ya están en `/me`.
      // DEPENDE de la migración `xp-perfil-completado`, todavía sin aplicar.
      expect(meResponse.body.profile.xp).toBe(20);
    },
    30_000,
  );

  it('POST /invitations/redeem con un código inexistente -> 400 INVITATION_INVALID', async () => {
    const user = await newUser('Invalid Code');

    const response = await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(user.accessToken))
      .send({ code: 'ZZZZZZZZ' })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'INVITATION_INVALID', statusCode: 400 });
  });

  it('POST /invitations/redeem con un código ya usado -> 400 INVITATION_USED', async () => {
    const owner = await newUser('Owner Used');
    const group = await newGroup('Grupo used', owner.id);
    const code = await newInvitation(group.id, owner.id);

    const firstUser = await newUser('First Used');
    const secondUser = await newUser('Second Used');

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(firstUser.accessToken))
      .send({ code })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const response = await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(secondUser.accessToken))
      .send({ code })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'INVITATION_USED', statusCode: 400 });
  });

  it('POST /invitations/redeem con un código caducado -> 400 INVITATION_EXPIRED', async () => {
    const owner = await newUser('Owner Expired');
    const group = await newGroup('Grupo expired', owner.id);
    // Invitación sembrada directamente con el cliente admin, ya caducada.
    const code = await newInvitation(group.id, owner.id, -60_000);

    const user = await newUser('Expired Redeemer');

    const response = await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(user.accessToken))
      .send({ code })
      .expect(400);

    expect(response.body).toMatchObject({ error: 'INVITATION_EXPIRED', statusCode: 400 });
  });

  it('POST /invitations/redeem dos códigos con el mismo usuario -> 409 ALREADY_IN_GROUP', async () => {
    const owner = await newUser('Owner Twice');
    const groupA = await newGroup('Grupo twice A', owner.id);
    const groupB = await newGroup('Grupo twice B', owner.id);
    const codeA = await newInvitation(groupA.id, owner.id);
    const codeB = await newInvitation(groupB.id, owner.id);

    const user = await newUser('Twice Redeemer');

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(user.accessToken))
      .send({ code: codeA })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const response = await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(user.accessToken))
      .send({ code: codeB })
      .expect(409);

    expect(response.body).toMatchObject({ error: 'ALREADY_IN_GROUP', statusCode: 409 });
  });

  it('GET /v1/group devuelve a los dos miembros y ninguna columna prohibida', async () => {
    const owner = await newUser('Owner Group');
    const group = await newGroup('Grupo listado', owner.id);
    // El owner también debe canjear un código para su propio grupo: `owner_id`
    // en `groups` no implica `profiles.group_id` (son cosas distintas).
    const ownerCode = await newInvitation(group.id, owner.id);
    const memberCode = await newInvitation(group.id, owner.id);
    const member = await newUser('Member Group');

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(owner.accessToken))
      .send({ code: ownerCode })
      .expect((res) => expect([200, 201]).toContain(res.status));

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(member.accessToken))
      .send({ code: memberCode })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const response = await request(app.getHttpServer())
      .get('/v1/group')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.group).toMatchObject({ id: group.id, name: group.name });
    expect(response.body.members).toHaveLength(2);

    const memberIds = response.body.members.map((m: { userId: string }) => m.userId);
    expect(memberIds).toEqual(expect.arrayContaining([owner.id, member.id]));

    const allowedKeys = ['userId', 'displayName', 'level', 'xp', 'streak', 'lastSessionDay'];
    for (const row of response.body.members) {
      expect(Object.keys(row).sort()).toEqual([...allowedKeys].sort());
    }
  });

  it('POST /v1/admin/invitations: 403 para un miembro que no es owner, codes para el owner', async () => {
    const owner = await newUser('Owner Admin');
    const group = await newGroup('Grupo admin', owner.id);
    // El owner también necesita `profiles.group_id` propio: sin grupo,
    // `POST /admin/invitations` daría 409 NOT_ONBOARDED antes de llegar al
    // chequeo de owner.
    const ownerCode = await newInvitation(group.id, owner.id);
    const memberCode = await newInvitation(group.id, owner.id);
    const member = await newUser('Member Admin');

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(owner.accessToken))
      .send({ code: ownerCode })
      .expect((res) => expect([200, 201]).toContain(res.status));

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(member.accessToken))
      .send({ code: memberCode })
      .expect((res) => expect([200, 201]).toContain(res.status));

    const forbiddenResponse = await request(app.getHttpServer())
      .post('/v1/admin/invitations')
      .set(authHeader(member.accessToken))
      .send({ count: 1 })
      .expect(403);
    expect(forbiddenResponse.body).toMatchObject({ error: 'FORBIDDEN' });

    const ownerResponse = await request(app.getHttpServer())
      .post('/v1/admin/invitations')
      .set(authHeader(owner.accessToken))
      .send({ count: 2 });

    expect([200, 201]).toContain(ownerResponse.status);
    expect(Array.isArray(ownerResponse.body.codes)).toBe(true);
    expect(ownerResponse.body.codes).toHaveLength(2);
    seededInvitationCodes.push(...ownerResponse.body.codes);
  });

  it('DELETE /v1/me deja GET /v1/me con un perfil recién creado de cero', async () => {
    const owner = await newUser('Owner Delete');
    const group = await newGroup('Grupo delete', owner.id);
    const code = await newInvitation(group.id, owner.id);
    const user = await newUser('Delete Me');

    await request(app.getHttpServer())
      .post('/v1/invitations/redeem')
      .set(authHeader(user.accessToken))
      .send({ code })
      .expect((res) => expect([200, 201]).toContain(res.status));

    await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set(authHeader(user.accessToken))
      .send({
        displayName: 'Se Borra',
        level: 'A2',
        interests: VALID_INTERESTS,
        timezone: 'America/Sao_Paulo',
        locale: 'es',
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/v1/me')
      .set(authHeader(user.accessToken))
      .expect(204);

    const meAfterDelete = await request(app.getHttpServer())
      .get('/v1/me')
      .set(authHeader(user.accessToken))
      .expect(200);

    // ensureProfile recrea la fila de cero: sin grupo, sin onboarding, con
    // los valores por defecto (docs/specs/pendientes/PR-02.md).
    expect(meAfterDelete.body.onboarded).toBe(false);
    expect(meAfterDelete.body.group).toBeNull();
    expect(meAfterDelete.body.profile.interests).toEqual([]);
    expect(meAfterDelete.body.profile.level).toBe('A2');
  });
});
