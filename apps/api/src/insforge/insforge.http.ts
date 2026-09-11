import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * Tope de cada llamada HTTP a InsForge (MEJ-27).
 *
 * `fetch` no trae timeout propio: sin esto, una conexión que se queda colgada
 * bloquea el `AuthGuard` —y por tanto cualquier petición autenticada— hasta
 * que el sistema operativo se rinda, que son minutos. Todos estos métodos ya
 * devuelven un valor de reserva ante un fallo, así que abortar antes solo
 * adelanta el camino que ya existía.
 */
const INSFORGE_TIMEOUT_MS = 5_000;

export type CurrentSessionResult =
  | { ok: true; userId: string }
  | { ok: false };

/** Usuario de InsForge tal y como lo devuelve `GET /api/auth/users/:id`. */
export interface InsforgeAuthUser {
  readonly id: string;
  readonly email: string | null;
  /** `profile.name` del usuario en InsForge (nombre elegido al registrarse). */
  readonly name: string | null;
}

/**
 * Cliente HTTP ligero y tipado para los endpoints de InsForge que no cubre
 * `@insforge/sdk` desde el lado servidor de esta API (verificación de
 * sesiones de usuario, lectura de usuarios de auth con la clave admin y
 * health check). Usa el `fetch` global de Node 24, sin librerías extra.
 *
 * Recibe su configuración (`baseUrl`, `apiKey`) desde `ConfigService`, no
 * lee `process.env` directamente.
 */
@Injectable()
export class InsforgeHttp {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(configService: ConfigService<Env, true>) {
    this.baseUrl = configService.get('INSFORGE_URL', { infer: true });
    this.apiKey = configService.get('INSFORGE_API_KEY', { infer: true });
  }

  /**
   * `GET {INSFORGE_URL}/api/auth/sessions/current` con
   * `Authorization: Bearer <accessToken>` (SPEC-02).
   *
   * La forma exacta del JSON de respuesta de InsForge no está documentada
   * en las specs de este repo. Se es defensivo: se intenta leer `data.id`
   * o `data.user.id` con optional chaining (ver entrada en
   * docs/specs/pendientes/PR-08.md sobre esta decisión).
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
          signal: AbortSignal.timeout(INSFORGE_TIMEOUT_MS),
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
   * `GET {INSFORGE_URL}/api/auth/users/:id` con la clave admin
   * (`Authorization: Bearer <INSFORGE_API_KEY>`), para leer el nombre y el
   * email de un usuario de auth. InsForge Cloud no expone un JOIN a
   * `auth.users` por PostgREST, así que la creación perezosa del perfil
   * (`ProfilesRepository.ensureProfile`, ver docs/specs/pendientes/PR-02.md)
   * necesita este endpoint para elegir un `display_name` inicial razonable.
   *
   * Devuelve `null` si el usuario no existe (404) o si la petición falla por
   * cualquier motivo (red, InsForge caído): nunca lanza, igual que
   * `getCurrentSession`. Quien llama decide el valor de reserva.
   */
  async getAuthUser(userId: string): Promise<InsforgeAuthUser | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/users/${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: AbortSignal.timeout(INSFORGE_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        id?: unknown;
        email?: unknown;
        name?: unknown;
        profile?: { name?: unknown } | null;
      } | null;

      const id = data?.id;
      if (typeof id !== 'string' || id.length === 0) {
        return null;
      }

      const email = typeof data?.email === 'string' ? data.email : null;
      const name =
        (typeof data?.profile?.name === 'string' ? data.profile.name : null) ??
        (typeof data?.name === 'string' ? data.name : null);

      return { id, email, name };
    } catch {
      return null;
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
        signal: AbortSignal.timeout(INSFORGE_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
