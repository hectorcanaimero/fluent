import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  // Sin cabecera `Authorization`: `/v1/health` es la única ruta pública
  // (SPEC-02 §4), marcada con `@Public()` en `HealthController`, así que el
  // `AuthGuard` global (APP_GUARD, PR-02/T1) la deja pasar sin bearer. Si
  // alguien quitase ese decorador, este test fallaría con 401.
  //
  // `.env.test` (apps/api/.env.test) apunta REDIS_URL e INSFORGE_URL a
  // valores ficticios/no alcanzables (ver docs/specs/pendientes/PR-08.md, T3 de
  // PR-08), así que en este entorno e2e `redis.ok` e `insforge.ok` son
  // `false` de forma determinista y rápida (RedisModule/InsforgeModule usan
  // conexiones/timeouts acotados, sin reintentos indefinidos). Este test
  // verifica la forma de la respuesta y que el endpoint sigue devolviendo
  // HTTP 200 siempre, no el valor real de cada `ok` (que depende de
  // infraestructura externa real, fuera del alcance de este PR).
  it('/v1/health (GET) responds 200 with the full health shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200);

    expect(typeof response.body.ok).toBe('boolean');
    expect(typeof response.body.version).toBe('string');
    expect(typeof response.body.redis.ok).toBe('boolean');
    expect(typeof response.body.insforge.ok).toBe('boolean');
  });

  afterEach(async () => {
    await app.close();
  });
});
