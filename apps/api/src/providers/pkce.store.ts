import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

/** SPEC-02 §4.2: «la API genera y guarda el `code_verifier` en Redis 10 min». */
export const PKCE_TTL_SECONDS = 600;

/** Prefijo propio de las claves de Redis del PKCE de OpenRouter. */
export const PKCE_KEY_PREFIX = 'pkce:openrouter:';

/** Clave de Redis de un intento de PKCE. */
export function pkceKey(codeVerifierId: string): string {
  return `${PKCE_KEY_PREFIX}${codeVerifierId}`;
}

/**
 * Lo que se guarda junto al `code_verifier`: el usuario que empezó el flujo
 * (para que nadie pueda canjear el intento de otro) y el `callbackUrl` con el
 * que se construyó el `authUrl` (informativo y útil para depurar).
 */
export interface PkceEntry {
  readonly userId: string;
  readonly callbackUrl: string;
  readonly codeVerifier: string;
  readonly createdAt: string;
  /**
   * `code` de OpenRouter, escrito por el callback público del navegador
   * (`attachCode`). Ausente hasta que el usuario vuelve de autorizar; el
   * canje lo hace después `POST /pkce/complete`, ya autenticado (MAL-18).
   */
  readonly code?: string;
}

/**
 * Almacén en Redis de los `code_verifier` del flujo PKCE (SPEC-02 §4.2).
 *
 * El id es un `randomUUID` opaco: es lo único que viaja a la app, y sin él (y
 * sin ser su dueño) no se puede canjear el `code` de OpenRouter.
 *
 * `RedisService` nunca lanza (docs/specs/pendientes/PR-02.md PEND-01/PEND-07):
 * si Redis está caído, `create` devuelve un id cuyo verifier no se llegó a
 * guardar y `complete` responderá el mismo error controlado que un intento
 * caducado. Es la degradación aceptable: sin Redis no hay forma de completar
 * un PKCE, pero tampoco se rompe nada más de la API.
 */
@Injectable()
export class PkceStore {
  private readonly logger = new Logger(PkceStore.name);

  constructor(private readonly redis: RedisService) {}

  /** Guarda el verifier 10 minutos y devuelve el id opaco (`codeVerifierId`). */
  async create(userId: string, callbackUrl: string, codeVerifier: string): Promise<string> {
    const codeVerifierId = randomUUID();
    const entry: PkceEntry = {
      userId,
      callbackUrl,
      codeVerifier,
      createdAt: new Date().toISOString(),
    };

    await this.redis.set(pkceKey(codeVerifierId), JSON.stringify(entry), PKCE_TTL_SECONDS);

    return codeVerifierId;
  }

  /** Lee un intento. `null` si no existe, caducó o el valor está corrupto. */
  async find(codeVerifierId: string): Promise<PkceEntry | null> {
    const raw = await this.redis.get(pkceKey(codeVerifierId));
    if (raw === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PkceEntry>;
      if (
        typeof parsed.userId === 'string' &&
        typeof parsed.callbackUrl === 'string' &&
        typeof parsed.codeVerifier === 'string'
      ) {
        return {
          userId: parsed.userId,
          callbackUrl: parsed.callbackUrl,
          codeVerifier: parsed.codeVerifier,
          createdAt: parsed.createdAt ?? new Date(0).toISOString(),
          ...(typeof parsed.code === 'string' ? { code: parsed.code } : {}),
        };
      }
    } catch {
      // Valor corrupto: se trata como si no existiera.
    }

    this.logger.warn(`Intento de PKCE con un valor ilegible en Redis; se descarta.`);
    return null;
  }

  /**
   * Guarda el `code` que OpenRouter devolvió al navegador, en la misma
   * entrada que el `code_verifier` (MAL-18): el callback público no canjea
   * nada, solo deja el código a la espera de que su dueño llame a
   * `POST /pkce/complete` con el bearer.
   *
   * Conserva el vencimiento original en vez de reiniciar el TTL: la ventana
   * de 10 minutos se cuenta desde `start`, así que volver del navegador no
   * puede alargarla. Si ya venció, no escribe nada y devuelve `null`.
   */
  async attachCode(codeVerifierId: string, code: string): Promise<PkceEntry | null> {
    const entry = await this.find(codeVerifierId);
    if (entry === null) {
      return null;
    }

    const elapsedSeconds = Math.floor((Date.now() - Date.parse(entry.createdAt)) / 1000);
    const remaining = PKCE_TTL_SECONDS - (Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
    if (remaining <= 0) {
      await this.remove(codeVerifierId);
      return null;
    }

    const updated: PkceEntry = { ...entry, code };
    await this.redis.set(pkceKey(codeVerifierId), JSON.stringify(updated), remaining);

    return updated;
  }

  /** Borra el intento: un `code_verifier` es de un solo uso. */
  async remove(codeVerifierId: string): Promise<void> {
    await this.redis.del(pkceKey(codeVerifierId));
  }
}
