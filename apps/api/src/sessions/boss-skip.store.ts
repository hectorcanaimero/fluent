import { Injectable } from '@nestjs/common';
import type { BossSkipStore } from '../game/boss.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BOSS_SKIP_KEY_PREFIX, BOSS_SKIP_TTL_SECONDS } from './sessions.constants.js';

/** Clave del rechazo diario del boss: `boss:skip:<userId>:<YYYY-MM-DD>`. */
export function bossSkipKey(userId: string, day: string): string {
  return `${BOSS_SKIP_KEY_PREFIX}:${userId}:${day}`;
}

/**
 * Implementación de `BossSkipStore` (`src/game/boss.service.ts`) sobre Redis,
 * que es lo que dejó pendiente PR-07/T3.
 *
 * **Degradación si Redis está caído (ver docs/specs/pendientes/PR-04.md):**
 * `RedisService` nunca lanza — un `GET` fallido es indistinguible de un *miss*
 * y devuelve `null`, y un `SET` fallido solo se loguea. Con eso,
 * `wasSkippedToday` devuelve `false` cuando Redis no responde, así que el boss
 * **sí** se ofrece. Es la degradación benigna: como mucho se le vuelve a
 * ofrecer un boss a alguien que ya lo rechazó hoy (que puede volver a
 * rechazarlo sin penalización, SPEC-07 §4), en vez de bloquear un boss que le
 * tocaba.
 */
@Injectable()
export class RedisBossSkipStore implements BossSkipStore {
  constructor(private readonly redis: RedisService) {}

  async wasSkippedToday(userId: string, day: string): Promise<boolean> {
    const value = await this.redis.get(bossSkipKey(userId, day));
    return value !== null;
  }

  async recordSkip(userId: string, day: string): Promise<void> {
    await this.redis.set(bossSkipKey(userId, day), '1', BOSS_SKIP_TTL_SECONDS);
  }
}
