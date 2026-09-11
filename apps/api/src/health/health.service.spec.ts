import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { HealthService, HEALTH_CACHE_MS } from './health.service.js';
import { RedisService } from '../redis/redis.service.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';
import type { Env } from '../config/env.js';

/**
 * `HealthService` con Redis simulado (`ioredis-mock`) y `fetch` simulado
 * (`vi.fn()`), sin tocar red ni Redis real. Ver docs/tasks/PR-08-infraestructura.md
 * T3 y docs/specs/pendientes/PR-08.md.
 */
describe('HealthService', () => {
  const configServiceMock = {
    get: vi.fn((key: string) => {
      if (key === 'INSFORGE_URL') return 'https://example.test.insforge.app';
      if (key === 'INSFORGE_API_KEY') return 'fake-api-key';
      throw new Error(`unexpected config key in test: ${key}`);
    }),
  } as unknown as ConfigService<Env, true>;

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Reloj controlable, para poder probar la caché sin esperar. */
  let clock = 0;

  function buildHealthService(cacheClient: Redis): HealthService {
    const redisService = new RedisService(cacheClient);
    const insforgeHttp = new InsforgeHttp(configServiceMock);
    return new HealthService(redisService, insforgeHttp, () => clock);
  }

  it('reports ok:true with redis.ok:true and insforge.ok:true when both are healthy', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const healthService = buildHealthService(cacheClient);
    const result = await healthService.check();

    expect(result.ok).toBe(true);
    expect(result.redis).toEqual({ ok: true });
    expect(result.insforge).toEqual({ ok: true });
    expect(typeof result.version).toBe('string');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test.insforge.app/api/health',
      { method: 'GET', signal: expect.anything() },
    );
  });

  it('liveness sigue en ok:true con Redis caído (MEJ-27)', async () => {
    const failingCacheClient = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const healthService = buildHealthService(failingCacheClient);
    const result = await healthService.check();

    // Reiniciar la API porque Redis no contesta no arregla nada.
    expect(result.ok).toBe(true);
    expect(result.redis).toEqual({ ok: false });
    expect(result.insforge).toEqual({ ok: true });
  });

  it('readiness sí baja a ok:false con Redis caído (MEJ-27)', async () => {
    const failingCacheClient = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await buildHealthService(failingCacheClient).ready();

    expect(result.ok).toBe(false);
    expect(result.redis).toEqual({ ok: false });
  });

  it('readiness baja a ok:false si InsForge falla (MEJ-27)', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const healthService = buildHealthService(cacheClient);
    const liveness = await healthService.check();
    const readiness = await healthService.ready();

    expect(liveness.ok).toBe(true);
    expect(readiness.ok).toBe(false);
    expect(readiness.insforge).toEqual({ ok: false });
  });

  it('con Redis e InsForge caídos, liveness sigue ok y readiness no (MEJ-27)', async () => {
    const failingCacheClient = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Redis;
    fetchMock.mockRejectedValue(new Error('network error'));

    const healthService = buildHealthService(failingCacheClient);
    expect((await healthService.check()).ok).toBe(true);
    const result = await healthService.ready();

    expect(result.ok).toBe(false);
    expect(result.redis).toEqual({ ok: false });
    expect(result.insforge).toEqual({ ok: false });
  });

  it('reutiliza el resultado durante la ventana de caché (MEJ-27)', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    clock = 1_000;

    const healthService = buildHealthService(cacheClient);
    await healthService.check();
    await healthService.check();
    await healthService.ready();

    // Coolify pregunta cada pocos segundos: sin caché cada respuesta costaba
    // un PING a Redis y un GET a InsForge.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('vuelve a comprobar pasada la ventana (MEJ-27)', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    clock = 1_000;

    const healthService = buildHealthService(cacheClient);
    await healthService.check();
    clock += HEALTH_CACHE_MS + 1;
    await healthService.check();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('las llamadas concurrentes comparten una sola comprobación (MEJ-27)', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    clock = 1_000;

    const healthService = buildHealthService(cacheClient);
    await Promise.all([
      healthService.check(),
      healthService.check(),
      healthService.ready(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
