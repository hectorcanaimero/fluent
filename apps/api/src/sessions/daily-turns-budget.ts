import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Plan } from '../db/schema.js';
import { RedisService } from '../redis/redis.service.js';
import { secondsUntilUserMidnight, turnsDayKey, userDay } from './user-day.js';

const TURNS_DAILY_CAP_MESSAGE =
  'Por hoy alcanzaste el máximo de turnos. Mañana seguimos.';
const TURNS_DAILY_CAP_FREE_MESSAGE =
  'Por hoy alcanzaste el máximo de turnos del plan Free. Mañana seguimos, o pásate a Pro para ampliar el tope.';

/**
 * Tope diario de turnos (MAL-23), extraído de `TurnsService` para que el
 * worker de `group-tutor` (F7.3) lo use sin pasar por el servicio HTTP.
 *
 * El día es el **natural del aprendiz** (`profiles.timezone`), no UTC: a
 * alguien en Buenos Aires no se le puede reiniciar el cupo a las 21:00 de
 * su tarde. `Retry-After` lleva los segundos que faltan para su medianoche,
 * que es cuando el contador caduca de verdad.
 *
 * El tope depende del plan: `TURNS_DAILY_CAP_PRO` o `TURNS_DAILY_CAP_FREE`.
 * Con el tope a 0 queda desactivado. Con Redis caído `increment` devuelve
 * `null` y se deja pasar (fail-open), igual que el lock de turno: bloquear a
 * todo el mundo durante una caída de Redis es peor que perder temporalmente
 * el tope.
 */
@Injectable()
export class DailyTurnsBudget {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  /** Cuenta el turno del día y rechaza con `429 TURNS_DAILY_CAP` al pasarse. */
  async consume(userId: string, plan: Plan, tz: string, now: Date = new Date()): Promise<void> {
    const pro = plan === 'pro';
    const cap = this.configService.get(pro ? 'TURNS_DAILY_CAP_PRO' : 'TURNS_DAILY_CAP_FREE', {
      infer: true,
    });
    if (cap <= 0) {
      return;
    }

    const retryAfter = secondsUntilUserMidnight(tz, now);
    const key = turnsDayKey(userId, userDay(tz, now));

    const used = await this.redis.increment(key, retryAfter);
    if (used === null || used <= cap) {
      return;
    }

    throw ApiException.of('TURNS_DAILY_CAP', pro ? TURNS_DAILY_CAP_MESSAGE : TURNS_DAILY_CAP_FREE_MESSAGE, {
      extra: { retryAfter },
    });
  }
}
