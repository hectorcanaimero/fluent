import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service.js';
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

  function buildHealthService(cacheClient: Redis): HealthService {
    const redisService = new RedisService(cacheClient);
    const insforgeHttp = new InsforgeHttp(configServiceMock);
    return new HealthService(redisService, insforgeHttp);
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
      { method: 'GET' },
    );
  });

  it('reports ok:false when Redis PING fails', async () => {
    const failingCacheClient = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const healthService = buildHealthService(failingCacheClient);
    const result = await healthService.check();

    expect(result.ok).toBe(false);
    expect(result.redis).toEqual({ ok: false });
    expect(result.insforge).toEqual({ ok: true });
  });

  it('reports ok:false when InsForge health check fails', async () => {
    const cacheClient = new RedisMock() as unknown as Redis;
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const healthService = buildHealthService(cacheClient);
    const result = await healthService.check();

    expect(result.ok).toBe(false);
    expect(result.redis).toEqual({ ok: true });
    expect(result.insforge).toEqual({ ok: false });
  });

  it('reports ok:false when both Redis and InsForge are down', async () => {
    const failingCacheClient = {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Redis;
    fetchMock.mockRejectedValue(new Error('network error'));

    const healthService = buildHealthService(failingCacheClient);
    const result = await healthService.check();

    expect(result.ok).toBe(false);
    expect(result.redis).toEqual({ ok: false });
    expect(result.insforge).toEqual({ ok: false });
  });
});
