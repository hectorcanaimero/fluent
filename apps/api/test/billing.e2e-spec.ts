import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  applyInsforgeE2eEnv,
  cleanupE2eData,
  createE2eAdminClient,
  loadInsforgeE2eCredentials,
  registerE2eUser,
} from './insforge-e2e.js';

/**
 * e2e de F4.1.T1: `POST /v1/webhooks/revenuecat`.
 *
 * El 401 corre siempre (no toca InsForge). El `INITIAL_PURCHASE` que deja al
 * usuario Pro en `GET /me` necesita la rama real de InsForge (mismas
 * credenciales que `profiles-groups.e2e-spec.ts`); sin ellas se salta.
 *
 * El secreto se fija en `process.env` antes del `import()` dinámico de
 * `AppModule`: `ConfigModule.forRoot` valida el entorno al evaluarse (ver la
 * cabecera de `admin.e2e-spec.ts`).
 */
const SECRET = 'rc_e2e_secret';
process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;

const credentials = loadInsforgeE2eCredentials();
if (credentials) applyInsforgeE2eEnv(credentials);
const withInsforge = credentials ? it : it.skip;

describe('POST /v1/webhooks/revenuecat (e2e)', () => {
  let app: INestApplication<App>;
  const seededUserIds: string[] = [];

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (credentials) {
      await cleanupE2eData(createE2eAdminClient(credentials), {
        userIds: seededUserIds,
      });
    }
    await app?.close();
  }, 30_000);

  it.each([undefined, 'Bearer otro-secreto'])(
    'responde 401 UNAUTHENTICATED con Authorization %s',
    async (authorization) => {
      const req = request(app.getHttpServer()).post('/v1/webhooks/revenuecat');
      if (authorization) req.set('Authorization', authorization);
      const response = await req.send({ event: { type: 'INITIAL_PURCHASE' } }).expect(401);

      expect(response.body).toMatchObject({ error: 'UNAUTHENTICATED', statusCode: 401 });
    },
  );

  withInsforge(
    'INITIAL_PURCHASE con entitlement pro deja al usuario Pro en GET /me',
    async () => {
      const user = await registerE2eUser(credentials!, 'Billing E2E');
      seededUserIds.push(user.id);
      const bearer = { Authorization: `Bearer ${user.accessToken}` };

      // Crea el perfil (free) si aún no existe.
      const before = await request(app.getHttpServer()).get('/v1/me').set(bearer).expect(200);
      expect(before.body.plan).toBe('free');

      const expirationAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await request(app.getHttpServer())
        .post('/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            type: 'INITIAL_PURCHASE',
            id: 'evt_e2e',
            app_user_id: user.id,
            entitlement_ids: ['pro'],
            expiration_at_ms: expirationAtMs,
            store: 'PLAY_STORE',
          },
        })
        .expect(200);

      const after = await request(app.getHttpServer()).get('/v1/me').set(bearer).expect(200);
      expect(after.body.plan).toBe('pro');
      expect(after.body.planExpiresAt).toBe(new Date(expirationAtMs).toISOString());
    },
    30_000,
  );
});
