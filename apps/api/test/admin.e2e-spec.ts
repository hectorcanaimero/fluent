import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

/**
 * Tests de endpoints administrativos (SPEC-02 §4.6, RF-8.2, PR-02/T8).
 *
 * `GET /admin/metrics`: solo el owner del sistema puede acceder.
 * Devuelve métricas del sistema (últimos 14 días):
 * - sessionsPerDay[]
 * - avgDurationSec
 * - llmFailureRate + totales
 *
 * Nota: estos tests no requieren conexión a InsForge real. Simplemente validan
 * que el endpoint existe y rechaza usuarios no-owner.
 */
describe('AdminController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  describe('GET /admin/metrics', () => {
    it('responde 401 sin bearer', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/metrics')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHENTICATED');
      expect(response.body.statusCode).toBe(401);
    });

    // El 403 para quien no es owner se cubre en
    // `src/admin/admin.service.spec.ts` (entra en `pnpm test`, que es lo que
    // corre el CI): allí se inyecta un `OwnerService` con un `OWNER_USER_ID`
    // conocido y se comprueba el código, el cuerpo de SPEC-02 §6 y que no se
    // lee nada de la base antes de rechazar. Reproducirlo aquí exigiría que
    // el `OWNER_USER_ID` de `.env.test` fuese un usuario real de la rama de
    // InsForge, que es justo lo que `.env.test` evita a propósito.
  });

  afterEach(async () => {
    await app.close();
  });
});
