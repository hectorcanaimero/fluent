import { Controller, Get, Logger, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-error.js';
import type { InsforgeHttp } from '../insforge/insforge.http.js';
import type { RedisService } from '../redis/redis.service.js';
import { AuthGuard, extractBearerToken } from './auth.guard.js';
import { AUTH_CACHE_TTL_SECONDS, authCacheKey } from './auth.constants.js';
import { Public } from './public.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';

/** Controlador protegido de mentira, para el `Reflector` real del guard. */
@Controller('protected')
class ProtectedController {
  @Get()
  handler(): void {}
}

/** Controlador marcado con `@Public()`, como `HealthController`. */
@Public()
@Controller('open')
class PublicController {
  @Get()
  handler(): void {}
}

type ControllerClass = typeof ProtectedController | typeof PublicController;

/**
 * `ExecutionContext` mínimo: solo lo que usa el guard (`switchToHttp`,
 * `getHandler`, `getClass`). Devuelve también la petición para poder
 * inspeccionar `request.user` después.
 */
function createContext(
  authorization?: string,
  controller: ControllerClass = ProtectedController,
): { context: ExecutionContext; request: AuthenticatedRequest } {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as unknown as AuthenticatedRequest;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => controller.prototype.handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;

  return { context, request };
}

/** Caché en memoria con la misma forma que `RedisService`. */
function createMemoryCache() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    store,
    ttls,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ttlSeconds: number) => {
      store.set(key, value);
      ttls.set(key, ttlSeconds);
    }),
    del: vi.fn(async (key: string) => store.delete(key)),
  };
}

/** Doble de Redis que simula un Redis caído: cada operación lanza. */
function createBrokenCache() {
  return {
    get: vi.fn(async () => {
      throw new Error('Connection is closed.');
    }),
    set: vi.fn(async () => {
      throw new Error('Connection is closed.');
    }),
    del: vi.fn(async () => {
      throw new Error('Connection is closed.');
    }),
  };
}

/** Doble de `InsforgeHttp` que solo acepta los tokens del mapa dado. */
function createInsforge(validTokens: Record<string, string>) {
  return {
    getCurrentSession: vi.fn(async (token: string) => {
      const userId = validTokens[token];
      return userId ? { ok: true as const, userId } : { ok: false as const };
    }),
  };
}

function createGuard(
  cache: { get: unknown; set: unknown; del: unknown },
  insforge: { getCurrentSession: unknown },
): AuthGuard {
  return new AuthGuard(
    new Reflector(),
    cache as unknown as RedisService,
    insforge as unknown as InsforgeHttp,
  );
}

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['BEARER abc', 'abc'],
    ['  Bearer   abc  ', 'abc'],
    ['Bearer\tabc', 'abc'],
  ])('extracts the token from %j', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });

  it.each([
    [undefined],
    [''],
    ['Bearer'],
    ['Bearer   '],
    ['Basic abc'],
    ['abc'],
  ])('returns null for %j', (header) => {
    expect(extractBearerToken(header as string | undefined)).toBeNull();
  });

  it('uses the first value when the header arrives repeated', () => {
    expect(extractBearerToken(['Bearer abc', 'Bearer def'])).toBe('abc');
  });
});

describe('AuthGuard', () => {
  beforeEach(() => {
    // El guard loguea `warn` cuando la caché falla; en tests solo interesa
    // que no propague el error, no el ruido en stderr.
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('introspects InsForge once per token within the cache TTL', async () => {
    const cache = createMemoryCache();
    const insforge = createInsforge({ 'token-a': 'user-a' });
    const guard = createGuard(cache, insforge);

    const requests: AuthenticatedRequest[] = [];

    for (let i = 0; i < 3; i += 1) {
      const { context, request } = createContext('Bearer token-a');
      await expect(guard.canActivate(context)).resolves.toBe(true);
      requests.push(request);
    }

    // SPEC-02 §2: como máximo una llamada a InsForge por usuario cada 5 min.
    expect(insforge.getCurrentSession).toHaveBeenCalledTimes(1);
    expect(insforge.getCurrentSession).toHaveBeenCalledWith('token-a');

    for (const request of requests) {
      expect(request.user).toEqual({ id: 'user-a' });
    }

    // Clave `auth:<sha256hex(token)>` y TTL de 300 s.
    const key = authCacheKey('token-a');
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(key, 'user-a', 300);
    expect(AUTH_CACHE_TTL_SECONDS).toBe(300);
    expect(key.startsWith('auth:')).toBe(true);
    expect(cache.store.get(key)).toBe('user-a');
  });

  it('caches per token: different tokens hit InsForge separately', async () => {
    const cache = createMemoryCache();
    const insforge = createInsforge({
      'token-a': 'user-a',
      'token-b': 'user-b',
    });
    const guard = createGuard(cache, insforge);

    const first = createContext('Bearer token-a');
    const second = createContext('Bearer token-b');
    const firstAgain = createContext('Bearer token-a');

    await guard.canActivate(first.context);
    await guard.canActivate(second.context);
    await guard.canActivate(firstAgain.context);

    expect(insforge.getCurrentSession).toHaveBeenCalledTimes(2);
    expect(first.request.user).toEqual({ id: 'user-a' });
    expect(second.request.user).toEqual({ id: 'user-b' });
    expect(firstAgain.request.user).toEqual({ id: 'user-a' });
    expect(cache.store.size).toBe(2);
    expect(authCacheKey('token-a')).not.toBe(authCacheKey('token-b'));
  });

  it('rejects an invalid token with 401 UNAUTHENTICATED and caches nothing', async () => {
    const cache = createMemoryCache();
    const insforge = createInsforge({});
    const guard = createGuard(cache, insforge);
    const { context, request } = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toThrow(ApiException);

    try {
      await guard.canActivate(context);
      expect.unreachable('el guard debía lanzar');
    } catch (error) {
      const exception = error as ApiException;
      expect(exception.getStatus()).toBe(401);
      expect(exception.getApiBody()).toEqual({
        error: 'UNAUTHENTICATED',
        message: expect.any(String),
        statusCode: 401,
      });
    }

    // Los fallos no se cachean: ni el `userId` ni una marca negativa.
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.store.size).toBe(0);
    expect(request.user).toBeUndefined();
  });

  it.each([
    ['sin cabecera Authorization', undefined],
    ['con un esquema que no es Bearer', 'Basic abc'],
    ['con un token vacío', 'Bearer   '],
  ])('rejects requests %s with 401 UNAUTHENTICATED', async (_name, header) => {
    const cache = createMemoryCache();
    const insforge = createInsforge({ 'token-a': 'user-a' });
    const guard = createGuard(cache, insforge);
    const { context } = createContext(header);

    try {
      await guard.canActivate(context);
      expect.unreachable('el guard debía lanzar');
    } catch (error) {
      const exception = error as ApiException;
      expect(exception).toBeInstanceOf(ApiException);
      expect(exception.getStatus()).toBe(401);
      expect(exception.getApiBody()).toEqual({
        error: 'UNAUTHENTICATED',
        message: expect.any(String),
        statusCode: 401,
      });
    }

    // Sin token no se toca ni Redis ni InsForge.
    expect(cache.get).not.toHaveBeenCalled();
    expect(insforge.getCurrentSession).not.toHaveBeenCalled();
  });

  it('lets @Public() routes through without touching Redis or InsForge', async () => {
    const cache = createMemoryCache();
    const insforge = createInsforge({});
    const guard = createGuard(cache, insforge);
    const { context, request } = createContext(undefined, PublicController);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(insforge.getCurrentSession).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('keeps working when Redis is down (cache failures are treated as misses)', async () => {
    const cache = createBrokenCache();
    const insforge = createInsforge({ 'token-a': 'user-a' });
    const guard = createGuard(cache, insforge);

    const first = createContext('Bearer token-a');
    const second = createContext('Bearer token-a');

    await expect(guard.canActivate(first.context)).resolves.toBe(true);
    await expect(guard.canActivate(second.context)).resolves.toBe(true);

    expect(first.request.user).toEqual({ id: 'user-a' });
    expect(second.request.user).toEqual({ id: 'user-a' });

    // Sin caché útil, cada petición vuelve a introspeccionar, pero ningún
    // error de Redis se propaga al cliente.
    expect(cache.get).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledTimes(2);
    expect(insforge.getCurrentSession).toHaveBeenCalledTimes(2);
  });

  it('still returns 401 for an invalid token while Redis is down', async () => {
    const cache = createBrokenCache();
    const insforge = createInsforge({});
    const guard = createGuard(cache, insforge);
    const { context } = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        error: 'UNAUTHENTICATED',
        statusCode: 401,
      },
    });
  });
});
