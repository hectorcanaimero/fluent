import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from './redis.service.js';

/**
 * Doble de `ioredis` con solo los comandos que usa `RedisService`. Se
 * prefiere sobre `ioredis-mock` porque permite comprobar los argumentos
 * exactos del comando (`SET key value EX ttl`) y simular fallos por método.
 */
function createRedisDouble() {
  return {
    ping: vi.fn(async () => 'PONG'),
    get: vi.fn(async (_key: string) => null as string | null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async (_key: string) => 1),
  };
}

function createService(double: ReturnType<typeof createRedisDouble>) {
  return new RedisService(double as unknown as Redis);
}

describe('RedisService', () => {
  beforeEach(() => {
    // El logger de Nest escribe en stderr; en tests solo interesa que no
    // se propaguen los errores, no el ruido.
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('pingCache', () => {
    it('returns true when Redis replies PONG', async () => {
      const double = createRedisDouble();
      await expect(createService(double).pingCache()).resolves.toBe(true);
    });

    it('returns false instead of throwing when Redis is down', async () => {
      const double = createRedisDouble();
      double.ping.mockRejectedValueOnce(new Error('Connection is closed.'));
      await expect(createService(double).pingCache()).resolves.toBe(false);
    });
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      const double = createRedisDouble();
      double.get.mockResolvedValueOnce('user-1');

      await expect(createService(double).get('auth:abc')).resolves.toBe(
        'user-1',
      );
      expect(double.get).toHaveBeenCalledWith('auth:abc');
    });

    it('returns null on a cache miss', async () => {
      const double = createRedisDouble();
      await expect(createService(double).get('auth:abc')).resolves.toBeNull();
    });

    it('returns null instead of throwing when Redis fails', async () => {
      const double = createRedisDouble();
      double.get.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(createService(double).get('auth:abc')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('writes the key with an EX expiry in seconds', async () => {
      const double = createRedisDouble();

      await expect(
        createService(double).set('auth:abc', 'user-1', 300),
      ).resolves.toBeUndefined();
      expect(double.set).toHaveBeenCalledWith('auth:abc', 'user-1', 'EX', 300);
    });

    it('swallows the error when Redis fails (CacheStore returns void)', async () => {
      const double = createRedisDouble();
      double.set.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(
        createService(double).set('auth:abc', 'user-1', 300),
      ).resolves.toBeUndefined();
    });
  });

  describe('setIfAbsent', () => {
    it('writes the key with SET … EX ttl NX and returns true', async () => {
      const double = createRedisDouble();

      await expect(
        createService(double).setIfAbsent('session:s1:turn', '1', 5),
      ).resolves.toBe(true);
      expect(double.set).toHaveBeenCalledWith('session:s1:turn', '1', 'EX', 5, 'NX');
    });

    it('returns false when the key already exists (Redis replies null)', async () => {
      const double = createRedisDouble();
      double.set.mockResolvedValueOnce(null as unknown as 'OK');

      await expect(
        createService(double).setIfAbsent('session:s1:turn', '1', 5),
      ).resolves.toBe(false);
    });

    it('fails open (true) instead of throwing when Redis is down', async () => {
      const double = createRedisDouble();
      double.set.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(
        createService(double).setIfAbsent('session:s1:turn', '1', 5),
      ).resolves.toBe(true);
    });
  });

  describe('del', () => {
    it('returns true when a key was removed', async () => {
      const double = createRedisDouble();

      await expect(createService(double).del('auth:abc')).resolves.toBe(true);
      expect(double.del).toHaveBeenCalledWith('auth:abc');
    });

    it('returns false when the key did not exist', async () => {
      const double = createRedisDouble();
      double.del.mockResolvedValueOnce(0);

      await expect(createService(double).del('auth:abc')).resolves.toBe(false);
    });

    it('returns false instead of throwing when Redis fails', async () => {
      const double = createRedisDouble();
      double.del.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(createService(double).del('auth:abc')).resolves.toBe(false);
    });
  });
});
