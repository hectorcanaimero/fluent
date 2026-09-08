import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

export type CurrentSessionResult =
  | { ok: true; userId: string }
  | { ok: false };

/**
 * Cliente HTTP ligero y tipado para los endpoints de InsForge que no cubre
 * `@insforge/sdk` desde el lado servidor de esta API (verificación de
 * sesiones de usuario y health check). Usa el `fetch` global de Node 24,
 * sin librerías extra.
 *
 * Recibe su configuración (`baseUrl`, `apiKey`) desde `ConfigService`, no
 * lee `process.env` directamente.
 */
@Injectable()
export class InsforgeHttp {
  private readonly baseUrl: string;

  constructor(configService: ConfigService<Env, true>) {
    this.baseUrl = configService.get('INSFORGE_URL', { infer: true });
  }

  /**
   * `GET {INSFORGE_URL}/api/auth/sessions/current` con
   * `Authorization: Bearer <accessToken>` (SPEC-02).
   *
   * La forma exacta del JSON de respuesta de InsForge no está documentada
   * en las specs de este repo. Se es defensivo: se intenta leer `data.id`
   * o `data.user.id` con optional chaining (ver entrada en
   * docs/specs/PENDIENTES.md sobre esta decisión).
   *
   * Nunca lanza: cualquier error de red se atrapa y devuelve `{ ok: false }`.
   */
  async getCurrentSession(accessToken: string): Promise<CurrentSessionResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/sessions/current`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        return { ok: false };
      }

      const data = (await response.json()) as {
        id?: unknown;
        user?: { id?: unknown };
      } | null;

      const userId = data?.id ?? data?.user?.id;

      if (typeof userId !== 'string' || userId.length === 0) {
        return { ok: false };
      }

      return { ok: true, userId };
    } catch {
      return { ok: false };
    }
  }

  /**
   * `GET {INSFORGE_URL}/api/health`.
   *
   * Decisión (ver PENDIENTES): no se envía `apiKey`, porque un endpoint de
   * health suele ser público y no hay ninguna spec que indique que requiera
   * autenticación. Devuelve `true` solo si la respuesta es 2xx; nunca lanza.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
