import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../config/env.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';

export interface OwnerCheckResult {
  ok: true;
}

export interface OwnerCheckError {
  ok: false;
  status: 401 | 403;
  error: string;
  message: string;
}

/**
 * Comprueba que un header `Authorization: Bearer <token>` pertenece al owner.
 * Reutilizable tanto en el guard de Nest como en middleware Express crudo.
 *
 * Nunca lanza: devuelve un objeto de resultado, no excepciones.
 */
export async function checkOwnerBearer(
  header: string | undefined,
  insforgeHttp: InsforgeHttp,
  ownerId: string,
): Promise<OwnerCheckResult | OwnerCheckError> {
  if (!header?.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHENTICATED',
      message: 'Falta el header Authorization',
    };
  }

  const token = header.slice('Bearer '.length);
  const session = await insforgeHttp.getCurrentSession(token);

  if (!session.ok) {
    return {
      ok: false,
      status: 401,
      error: 'UNAUTHENTICATED',
      message: 'Token inválido',
    };
  }

  if (session.userId !== ownerId) {
    return {
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Solo el operador puede acceder a este recurso',
    };
  }

  return { ok: true };
}

/**
 * Guard mínimo de "solo owner" para los endpoints de administración de PR-05
 * (SPEC-05 §9: «Bull Board... solo con bearer de owner»). No existe todavía
 * el `AuthGuard` con caché de PR-02/T1 (que verificará tokens de forma más
 * eficiente); este guard llama directamente a InsForge en cada petición.
 * Cuando PR-02 se fusione, este guard debería sustituirse por su
 * `AuthGuard` + una comprobación de owner equivalente (ver pendientes/PR-05.md).
 */
@Injectable()
export class OwnerAuthGuard implements CanActivate {
  constructor(
    private readonly insforgeHttp: InsforgeHttp,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const ownerId = this.configService.get('OWNER_USER_ID', { infer: true });

    const result = await checkOwnerBearer(header, this.insforgeHttp, ownerId);

    if (!result.ok) {
      if (result.status === 401) {
        throw new UnauthorizedException({
          error: result.error,
          message: result.message,
          statusCode: result.status,
        });
      } else {
        throw new ForbiddenException({
          error: result.error,
          message: result.message,
          statusCode: result.status,
        });
      }
    }

    return true;
  }
}
