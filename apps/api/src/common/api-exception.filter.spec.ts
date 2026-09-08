import 'reflect-metadata';
import { Body, Controller, Get, Global, Module, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { CommonModule } from './common.module.js';
import { ApiException } from './api-error.js';
import { I18nModule } from '../i18n/i18n.module.js';

/**
 * Tests de formato de error de PR-02/T3 (SPEC-02 §6, `docs/specs/README.md`
 * §«Errores de API»): cubren el criterio de aceptación de
 * `docs/tasks/PR-02-auth-y-api.md` («tests de formato de error para 400,
 * 401, 403, 404, 429, 500»), salvo 429 (rate limiting), que tiene su propio
 * archivo (`apps/api/src/rate-limit/user-throttler.guard.spec.ts`) porque
 * necesita `ThrottlerModule`.
 *
 * Arranca una app de Nest de juguete con solo `I18nModule` + `CommonModule`
 * (el filtro global y el `ValidationPipe` global que ese módulo registra vía
 * `APP_FILTER`/`APP_PIPE`) y un controlador de prueba que produce cada tipo
 * de excepción. No usa `AppModule` completo a propósito: no hace falta Redis
 * ni InsForge para probar el filtro, y así el test no depende de
 * infraestructura externa (a diferencia de `test/*.e2e-spec.ts`).
 */
class ToyValidateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  age!: number;
}

const ZOD_SCHEMA = z.object({
  email: z.string().email(),
});

@Controller('toy')
class ToyController {
  @Get('forbidden')
  forbidden(): never {
    throw ApiException.forbidden('No podés hacer esto.');
  }

  @Get('unauthenticated')
  unauthenticated(): never {
    throw ApiException.unauthenticated('Sin token.');
  }

  @Get('boom')
  boom(): never {
    throw new Error('detalle interno: contraseña=hunter2');
  }

  @Post('validate')
  validate(@Body() dto: ToyValidateDto): ToyValidateDto {
    return dto;
  }

  @Post('zod')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cuerpo sin tipar a propósito: zod lo valida, no class-validator
  zod(@Body() body: any): unknown {
    return ZOD_SCHEMA.parse(body);
  }
}

/** `ConfigService` de juguete: solo `NODE_ENV` importa para el filtro. */
function fakeConfigService(nodeEnv: string): Pick<ConfigService, 'get'> {
  return {
    get: ((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)) as ConfigService['get'],
  };
}

/**
 * `CommonModule` inyecta `ConfigService` en su propio scope de módulo: un
 * provider declarado en el módulo raíz de test no es visible para un módulo
 * importado (Nest solo resuelve hacia arriba a través de `imports`/
 * `exports`, nunca al revés). Se envuelve en un módulo `@Global()` para que
 * quede disponible en todo el árbol, igual que el `ConfigModule` real
 * (`isGlobal: true`) en `AppModule`.
 */
function buildFakeConfigModule(nodeEnv: string) {
  @Global()
  @Module({
    providers: [{ provide: ConfigService, useValue: fakeConfigService(nodeEnv) }],
    exports: [ConfigService],
  })
  class FakeConfigModule {}

  return FakeConfigModule;
}

async function buildApp(nodeEnv: 'development' | 'production'): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [buildFakeConfigModule(nodeEnv), I18nModule, CommonModule],
    controllers: [ToyController],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

describe('ApiExceptionFilter (formato de errores, SPEC-02 §6)', () => {
  describe('fuera de producción (NODE_ENV=development)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await buildApp('development');
    });

    afterAll(async () => {
      await app.close();
    });

    it('403 desde ApiException.forbidden(): cuerpo {error, message, statusCode}', async () => {
      const response = await request(app.getHttpServer()).get('/toy/forbidden').expect(403);

      expect(response.body).toEqual({
        error: 'FORBIDDEN',
        message: 'No podés hacer esto.',
        statusCode: 403,
      });
    });

    it('401 desde ApiException.unauthenticated(): cuerpo {error, message, statusCode}', async () => {
      const response = await request(app.getHttpServer())
        .get('/toy/unauthenticated')
        .expect(401);

      expect(response.body).toEqual({
        error: 'UNAUTHENTICATED',
        message: 'Sin token.',
        statusCode: 401,
      });
    });

    it('404 de ruta inexistente: {error: NOT_FOUND, statusCode: 404}, nunca el cuerpo por defecto de Nest', async () => {
      const response = await request(app.getHttpServer()).get('/no-existe-esta-ruta').expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.statusCode).toBe(404);
      expect(typeof response.body.message).toBe('string');
      // El cuerpo por defecto de Nest sería { message, error: 'Not Found', statusCode }.
      expect(response.body.error).not.toBe('Not Found');
    });

    it('400 desde ValidationPipe: VALIDATION con details[] con field y reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/toy/validate')
        .send({ age: 'no-es-un-numero' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION');
      expect(response.body.statusCode).toBe(400);
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);

      const fields = response.body.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('name');
      expect(fields).toContain('age');

      for (const detail of response.body.details) {
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.reason).toBe('string');
      }
    });

    it('400 desde un ZodError: VALIDATION con details[] derivados de error.issues', async () => {
      const response = await request(app.getHttpServer())
        .post('/toy/zod')
        .send({ email: 'no-es-un-email' })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'VALIDATION', statusCode: 400 });
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', reason: expect.any(String) }),
        ]),
      );
    });

    it('500 desde un Error genérico: fuera de producción puede incluir el mensaje original, nunca el stack', async () => {
      const response = await request(app.getHttpServer()).get('/toy/boom').expect(500);

      expect(response.body.error).toBe('INTERNAL');
      expect(response.body.statusCode).toBe(500);
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('en producción (NODE_ENV=production)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await buildApp('production');
    });

    afterAll(async () => {
      await app.close();
    });

    it('500 en producción: ni el mensaje interno ni el stack se filtran en el cuerpo', async () => {
      const response = await request(app.getHttpServer()).get('/toy/boom').expect(500);

      expect(response.body).toEqual({
        error: 'INTERNAL',
        message: expect.any(String),
        statusCode: 500,
      });
      expect(response.body.message).not.toContain('detalle interno');
      expect(response.body.message).not.toContain('hunter2');
      expect(JSON.stringify(response.body)).not.toContain('hunter2');
      expect(response.body.stack).toBeUndefined();
    });

    it('400/401/403/404 mantienen su forma también en producción', async () => {
      const forbidden = await request(app.getHttpServer()).get('/toy/forbidden').expect(403);
      expect(forbidden.body).toEqual({
        error: 'FORBIDDEN',
        message: 'No podés hacer esto.',
        statusCode: 403,
      });

      const notFound = await request(app.getHttpServer()).get('/no-existe').expect(404);
      expect(notFound.body.error).toBe('NOT_FOUND');
    });
  });
});
