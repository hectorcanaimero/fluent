import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { InsforgeHttp } from '../src/insforge/insforge.http.js';
import { mountBullBoard } from '../src/admin/bull-board.js';

// El reaper de testcontainers es otro contenedor más; se desactiva y el
// contenedor de Redis se para siempre en `afterAll` (try/finally) — mismo
// patrón que `test/coaching-brief-queue.e2e-spec.ts` (PR-05/T1).
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

/**
 * `GET /admin/metrics` llama a `Queue.getJobCounts()` y Bull Board introspecciona
 * las colas de verdad: ninguna de las dos tolera un Redis inexistente (a
 * diferencia de `RedisService.pingCache()` de `/v1/health`, que sí atrapa el
 * error). El `REDIS_URL` ficticio de `.env.test` (PR-08) hace que ambos
 * endpoints devuelvan 500. Por eso este test levanta un Redis real en
 * Docker, igual que `coaching-brief-queue.e2e-spec.ts`.
 *
 * IMPORTANTE: `AppModule` se importa con `import()` **dinámico** dentro de
 * `beforeAll`, no con un `import` estático de nivel de módulo. `AppModule`
 * declara `ConfigModule.forRoot({ envFilePath: '.env.test', ... })` en su
 * decorador `@Module()`, y `@nestjs/config` carga el `.env.test` (con
 * dotenv) de forma síncrona en el momento en que se **evalúa** esa llamada
 * — que con un `import` estático ocurre en cuanto Node carga este fichero
 * de test, antes de que corra ningún `beforeAll`. Si `AppModule` se
 * importara de forma estática, `process.env.REDIS_URL` ya estaría fijado
 * al valor ficticio de `.env.test` (`redis://localhost:6379`) para cuando
 * este `beforeAll` intenta sobreescribirlo con la URL real del contenedor,
 * y las colas de BullMQ se conectarían al Redis equivocado (con el síntoma
 * "Connection is closed." al primer comando, `ECONNREFUSED` de fondo).
 * Con `import()` dinámico, la evaluación de `app.module.ts` (y por tanto la
 * carga de `.env.test`) se retrasa hasta que este `beforeAll` la ejecuta,
 * ya con `process.env.REDIS_URL` apuntando al contenedor — `dotenv` no
 * pisa una variable que ya existe en `process.env`.
 */
describe('Admin Endpoints (e2e)', () => {
  let container: StartedTestContainer;
  let app: INestApplication<App>;
  let insforgeHttpMock: InsforgeHttp;
  let AppModule: typeof import('../src/app.module.js').AppModule;

  // Debe coincidir con `OWNER_USER_ID` de `apps/api/.env.test` (el
  // `ConfigModule` real de `AppModule` carga ese archivo cuando
  // `NODE_ENV=test`): `OwnerAuthGuard`/`checkOwnerBearer` comparan el
  // `userId` que devuelve `InsforgeHttp.getCurrentSession` (mockeado aquí)
  // contra ese valor de configuración real, no contra uno arbitrario.
  const ownerId = '9595625c-aea8-4120-accc-ed149d0a84c6';
  const otherUserId = 'other-user-id';

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    // `@nestjs/config` no pisa lo que ya está en `process.env`, así que esta
    // URL gana sobre la ficticia de `.env.test` — siempre que `AppModule` se
    // importe (y por tanto cargue `.env.test`) después de esta línea, ver
    // el comentario de cabecera.
    process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    ({ AppModule } = await import('../src/app.module.js'));
  }, 180_000);

  afterAll(async () => {
    await container?.stop();
  }, 60_000);

  beforeEach(async () => {
    insforgeHttpMock = {
      getCurrentSession: vi.fn(),
      checkHealth: vi.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InsforgeHttp)
      .useValue(insforgeHttpMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    // `mountBullBoard` monta `/admin/queues` (ver src/admin/bull-board.ts);
    // en producción lo hace `bootstrap()` de `main.ts`, que este test no
    // ejecuta, así que hay que llamarla explícitamente para que la ruta
    // exista en la app de test.
    mountBullBoard(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/admin/metrics', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    it('returns 401 when Authorization header is not Bearer', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .set('Authorization', 'Basic dGVzdDp0ZXN0')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    it('returns 401 when bearer token is invalid', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: false,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    it('returns 403 when bearer token belongs to non-owner user', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: otherUserId,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .set('Authorization', 'Bearer valid_token')
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.statusCode).toBe(403);
    });

    it('returns 200 with metrics when authenticated as owner', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: ownerId,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.queues).toBeDefined();
      expect(Array.isArray(response.body.queues)).toBe(true);
      expect(response.body.queues.length).toBe(4);

      // Verificar que cada cola tiene la estructura correcta
      response.body.queues.forEach(
        (queue: {
          name: string;
          waiting: number;
          active: number;
          failed: number;
        }) => {
          expect(typeof queue.name).toBe('string');
          expect(typeof queue.waiting).toBe('number');
          expect(typeof queue.active).toBe('number');
          expect(typeof queue.failed).toBe('number');
        },
      );
    });

    it('includes all 4 queue names in response', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: ownerId,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      const queueNames = response.body.queues.map(
        (q: { name: string }) => q.name,
      );
      expect(queueNames).toContain('brief');
      expect(queueNames).toContain('content');
      expect(queueNames).toContain('social');
      expect(queueNames).toContain('maintenance');
    });
  });

  describe('GET /admin/queues (Bull Board)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/queues')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    it('returns 401 when bearer token is invalid', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: false,
      });

      const response = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    it('returns 403 when bearer token belongs to non-owner user', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: otherUserId,
      });

      const response = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('Authorization', 'Bearer valid_token')
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.statusCode).toBe(403);
    });

    it('returns 200 when authenticated as owner', async () => {
      vi.mocked(insforgeHttpMock.getCurrentSession).mockResolvedValueOnce({
        ok: true,
        userId: ownerId,
      });

      // Bull Board responde con HTML, así que cualquier 2xx es suficiente
      // (no verificamos el contenido exacto porque depende de la librería @bull-board)
      const response = await request(app.getHttpServer())
        .get('/admin/queues')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });
});
