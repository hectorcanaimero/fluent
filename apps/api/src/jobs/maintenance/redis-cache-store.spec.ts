import type { Redis } from 'ioredis';

import { RedisCacheStore } from './redis-cache-store.js';

describe('RedisCacheStore', () => {
  it('get delega en redis.get', async () => {
    const get = vi.fn(async () => 'cached-value');
    const redis = { get } as unknown as Redis;
    const store = new RedisCacheStore(redis);

    const value = await store.get('some:key');

    expect(value).toBe('cached-value');
    expect(get).toHaveBeenCalledWith('some:key');
  });

  it('get devuelve null si redis no tiene la clave', async () => {
    const get = vi.fn(async () => null);
    const redis = { get } as unknown as Redis;
    const store = new RedisCacheStore(redis);

    expect(await store.get('missing')).toBeNull();
  });

  it('set delega en redis.set con EX y el TTL dado', async () => {
    const set = vi.fn(async () => 'OK');
    const redis = { set } as unknown as Redis;
    const store = new RedisCacheStore(redis);

    await store.set('some:key', 'value', 3600);

    expect(set).toHaveBeenCalledWith('some:key', 'value', 'EX', 3600);
  });
});
