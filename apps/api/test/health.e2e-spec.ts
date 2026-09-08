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

  it('/v1/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(typeof response.body.version).toBe('string');
  });

  afterEach(async () => {
    await app.close();
  });
});
