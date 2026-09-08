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
        };
      }
    } catch {
      // Valor corrupto: se trata como si no existiera.
    }

    this.logger.warn(`Intento de PKCE con un valor ilegible en Redis; se descarta.`);
    return null;
  }

  /** Borra el intento: un `code_verifier` es de un solo uso. */
  async remove(codeVerifierId: string): Promise<void> {
    await this.redis.del(pkceKey(codeVerifierId));
  }
}
