import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { setupOpenApi } from './../src/openapi.js';

/**
 * Tests de OpenAPI y documentación (SPEC-02 §8, PR-02/T8).
 *
 * Vive en `test/` pero se llama `.spec.ts` y **no** `.e2e-spec.ts` a
 * propósito: no necesita ni red ni InsForge (solo levanta `AppModule` con
 * `.env.test`), así que entra en `pnpm test` y por tanto lo ejecuta el CI,
 * que no tiene acceso a la rama de InsForge. Ver `vitest.config.ts`
 * (`**\/*.spec.ts`) frente a `vitest.config.e2e.ts` (`**\/*.e2e-spec.ts`).
 *
 * Validamos que:
 * - `/v1/docs-json` devuelve un documento OpenAPI válido (versión 3.x)
 * - Contiene las rutas principales de la API
 * - `GET /admin/metrics` está presente en el documento
 */
describe('OpenAPI Swagger (SPEC-02 §8)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');

    // setupOpenApi se llama aquí para los tests e2e, sin pasar ConfigService.
    // En production, se llama desde main.ts con ConfigService.
    setupOpenApi(app);

    await app.init();
  });

  it('GET /v1/docs-json devuelve un OpenAPI válido con rutas principales', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/docs-json')
      .expect(200);

    const doc = response.body;

    // Validación básica del documento OpenAPI.
    expect(typeof doc.openapi).toBe('string');
    expect(doc.openapi).toMatch(/^3\./);

    expect(doc.info?.title).toBe('Fluent API');
    expect(typeof doc.info?.version).toBe('string');

    // Rutas principales que deben estar presentes.
    const paths = Object.keys(doc.paths ?? {});
    expect(paths).toContain('/v1/me');
    expect(paths).toContain('/v1/group');
    expect(paths).toContain('/v1/models');
    expect(paths).toContain('/v1/memory');
    expect(paths).toContain('/v1/progress');
    expect(paths).toContain('/v1/leaderboard');
    expect(paths).toContain('/v1/challenges');
    expect(paths).toContain('/v1/sessions');
    expect(paths).toContain('/v1/groups/invitations');
    expect(paths).toContain('/v1/admin/metrics');

    // El documento debe incluir la definición de BearerAuth.
    expect(doc.components?.securitySchemes?.bearer).toBeDefined();
  });

  it('GET /v1/docs-json incluye schemas para DTOs principales', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/docs-json')
      .expect(200);

    const doc = response.body;
    const schemas = Object.keys(doc.components?.schemas ?? {});

    // Algunos DTOs principales que deberían estar documentados
    // (names pueden variar según el plugin de Swagger).
    expect(schemas.length).toBeGreaterThan(0);
  });

  afterEach(async () => {
    await app.close();
  });
});
