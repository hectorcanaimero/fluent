import 'reflect-metadata';
import { Controller, Get, Global, INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { NextFunction, Request, Response } from 'express';
import { RateLimitModule } from './rate-limit.module.js';
import { clientIpOf } from './user-throttler.guard.js';
import { CommonModule } from '../common/common.module.js';
import { I18nModule } from '../i18n/i18n.module.js';

/**
 * `ApiExceptionFilter` (registrado por `CommonModule`) inyecta `ConfigService`
 * para saber si `NODE_ENV === 'production'`. No hace falta el `ConfigModule`
 * real (con validación de todas las variables de entorno) solo para este
 * test de rate limiting: basta un `ConfigService` de juguete que siempre
 * dice "no es producción", envuelto en un módulo `@Global()` (un provider
 * del módulo raíz de test no es visible para `CommonModule`, que es un
 * módulo importado — ver el mismo patrón en
 * `api-exception.filter.spec.ts`).
 */
@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: { get: () => 'test' } }],
  exports: [ConfigService],
})
class FakeConfigModule {}

/**
 * Tests de rate limiting de PR-02/T3 (SPEC-02 §7).
 *
 * Cubre el resto del criterio de aceptación de
 * `docs/tasks/PR-02-auth-y-api.md` que no cabe en
 * `apps/api/src/common/api-exception.filter.spec.ts`: el 429 al superar el
 * límite con `error: 'RATE_LIMITED'`, y que la clave del límite es por
 * usuario (`request.user.id`) y no por IP — así el guard de throttling
 * corriendo después de `AuthGuard` (ver el comentario de orden en
 * `user-throttler.guard.ts`) da presupuestos independientes a cada usuario
 * autenticado, aunque las peticiones lleguen de la misma IP (como pasa
 * siempre en este test, todas van a `127.0.0.1`).
 *
 * No usa `AuthModule` de verdad (necesitaría Redis/InsForge): simula lo que
 * deja `AuthGuard` (`request.user = { id }`) con un middleware de Express
 * mínimo que lee una cabecera de prueba, antes de que corra
 * `UserThrottlerGuard`.
 */
@Controller('toy')
class ThrottledController {
  // Límite bajo (2 cada 60 s) solo para que el test no tenga que esperar el
  // límite real de 60/min; usa el throttler 'default' que registra
  // RateLimitModule, igual que haría cualquier ruta normal de la API.
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Get('limited')
  limited(): { ok: true } {
    return { ok: true };
  }
}

async function buildApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [FakeConfigModule, I18nModule, CommonModule, RateLimitModule],
    controllers: [ThrottledController],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Sustituto mínimo de AuthGuard (PR-02/T1): adjunta request.user a partir
  // de una cabecera de prueba, antes de que corra el ThrottlerGuard global.
  app.use((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
    const testUser = req.headers['x-test-user'];
    if (typeof testUser === 'string' && testUser.length > 0) {
      req.user = { id: testUser };
    }
    next();
  });

  await app.init();
  return app;
}

describe('UserThrottlerGuard (rate limiting, SPEC-02 §7)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deja pasar hasta el límite y responde 429 RATE_LIMITED al superarlo', async () => {
    await request(app.getHttpServer())
      .get('/toy/limited')
      .set('x-test-user', 'user-rate-a')
      .expect(200);

    await request(app.getHttpServer())
      .get('/toy/limited')
      .set('x-test-user', 'user-rate-a')
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .get('/toy/limited')
      .set('x-test-user', 'user-rate-a')
      .expect(429);

    expect(blocked.body).toMatchObject({ error: 'RATE_LIMITED', statusCode: 429 });
    expect(typeof blocked.body.message).toBe('string');
    // Nunca el cuerpo por defecto de la librería.
    expect(blocked.body.message).not.toContain('ThrottlerException');
  });

  it('el presupuesto es por usuario: otro usuario, aunque venga de la misma IP, no está bloqueado', async () => {
    // Sigue con la misma app del test anterior: user-rate-a ya agotó su
    // presupuesto; user-rate-b no ha hecho ninguna petición todavía.
    await request(app.getHttpServer())
      .get('/toy/limited')
      .set('x-test-user', 'user-rate-b')
      .expect(200);
  });
});

describe('clientIpOf · IP real detrás de Cloudflare (MEJ-30)', () => {
  it('prefiere CF-Connecting-IP a request.ip', () => {
    expect(
      clientIpOf({ headers: { 'cf-connecting-ip': '203.0.113.9' }, ip: '10.0.0.1' }),
    ).toBe('203.0.113.9');
  });

  it('cae a request.ip si no hay cabecera de Cloudflare', () => {
    expect(clientIpOf({ headers: {}, ip: '10.0.0.1' })).toBe('10.0.0.1');
  });

  it('ignora una cabecera vacía o de solo espacios', () => {
    expect(clientIpOf({ headers: { 'cf-connecting-ip': '   ' }, ip: '10.0.0.1' })).toBe(
      '10.0.0.1',
    );
  });

  it('con la cabecera repetida se queda con la primera', () => {
    expect(
      clientIpOf({ headers: { 'cf-connecting-ip': ['203.0.113.9', '198.51.100.2'] } }),
    ).toBe('203.0.113.9');
  });

  it('devuelve undefined si no hay ni cabecera ni ip', () => {
    expect(clientIpOf({ headers: {} })).toBeUndefined();
    expect(clientIpOf({})).toBeUndefined();
  });

  it('dos IPs distintas no comparten cubo de rate limit', () => {
    // La razón de ser del cambio: sin esto ambas resolvían a la IP del proxy
    // y todo el tráfico anónimo compartía presupuesto.
    const a = clientIpOf({ headers: { 'cf-connecting-ip': '203.0.113.9' }, ip: '10.0.0.1' });
    const b = clientIpOf({ headers: { 'cf-connecting-ip': '198.51.100.2' }, ip: '10.0.0.1' });

    expect(a).not.toBe(b);
  });
});
