import {
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-error.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';
import { RedisService } from '../redis/redis.service.js';
import { AUTH_CACHE_TTL_SECONDS, authCacheKey } from './auth.constants.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * `Bearer <token>` tolerante: esquema case-insensitive y espacios extra
 * antes, entre y después. El token debe tener al menos un carácter.
 */
const BEARER_PATTERN = /^\s*Bearer\s+(\S.*?)\s*$/i;

/**
 * Extrae el access token de una cabecera `Authorization`.
 *
 * Devuelve `null` si no hay cabecera, si el esquema no es `Bearer` o si el
 * token está vacío. Contempla el caso (raro pero posible en Node) de que
 * Express entregue la cabecera repetida como array.
 */
export function extractBearerToken(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;

  if (typeof raw !== 'string') {
    return null;
  }

  const match = BEARER_PATTERN.exec(raw);

  return match ? match[1] : null;
}

/**
 * Guard global de autenticación por introspección con caché (SPEC-02 §2).
 *
 * Flujo para cada petición no marcada con `@Public()`:
 *
 * 1. Extrae el bearer de `Authorization`. Sin token → `401 UNAUTHENTICATED`.
 * 2. Busca `auth:<sha256hex(token)>` en Redis. Si hay valor (el `userId`),
 *    **no** se llama a InsForge.
 * 3. Si no está en caché, llama a `InsforgeHttp.getCurrentSession(token)`.
 *    - `ok: true` → cachea el `userId` con TTL de 300 s y continúa.
 *    - `ok: false` → `401 UNAUTHENTICATED`. Los fallos **no se cachean**:
 *      un token puede pasar de inválido a válido (por ejemplo si InsForge
 *      estaba temporalmente caído) y cachear el fallo dejaría al usuario
 *      bloqueado 5 minutos sin motivo.
 * 4. Adjunta `request.user = { id: userId }`.
 *
 * Redis es una optimización de coste, no una dependencia dura: si la caché
 * falla (Redis caído, timeout) se trata como un *miss* y se sigue con la
 * introspección; un `set` fallido se ignora. Así una caída de Redis
 * encarece las llamadas a InsForge pero no tumba la autenticación.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly insforgeHttp: InsforgeHttp,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers?.authorization);

    if (!token) {
      throw ApiException.unauthenticated(
        'Falta la cabecera Authorization con un token Bearer.',
      );
    }

    const cacheKey = authCacheKey(token);
    const cachedUserId = await this.readCache(cacheKey);

    if (cachedUserId) {
      request.user = { id: cachedUserId };
      return true;
    }

    const session = await this.insforgeHttp.getCurrentSession(token);

    if (!session.ok) {
      throw ApiException.unauthenticated(
        'El token de acceso es inválido o ha expirado.',
      );
    }

    await this.writeCache(cacheKey, session.userId);
    request.user = { id: session.userId };

    return true;
  }

  /** `@Public()` en el handler o en el controlador (el handler manda). */
  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  /**
   * Lectura de caché a prueba de fallos: cualquier error se trata como
   * *miss*. `RedisService.get` ya no lanza, pero el `try/catch` cubre
   * también dobles o implementaciones futuras que sí lo hagan.
   */
  private async readCache(cacheKey: string): Promise<string | null> {
    try {
      return await this.redisService.get(cacheKey);
    } catch (error) {
      this.logger.warn(
        `Caché de auth no disponible al leer, se continúa con introspección: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Escritura de caché a prueba de fallos: un `set` fallido se ignora. */
  private async writeCache(cacheKey: string, userId: string): Promise<void> {
    try {
      await this.redisService.set(cacheKey, userId, AUTH_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Caché de auth no disponible al escribir, la sesión no se cachea: ${(error as Error).message}`,
      );
    }
  }
}
