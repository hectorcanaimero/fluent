import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';

import { TABLES } from '../db/schema.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';

/** Sesión `active` tal y como la necesita el barrido (SPEC-04 §6). */
export interface ActiveSessionRow {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: string; // ISO 8601
  /** Turnos **del usuario** (decisión de la sesión líder, PR-04/T1). */
  readonly turnsCount: number;
}

/**
 * Acceso a datos de `SessionSweeperService.run()` (SPEC-04 §6).
 *
 * Separado de `SessionsRepository`/`TurnsRepository` (que sirven a
 * peticiones HTTP con un `userId` de por medio) porque el barrido recorre
 * sesiones de **todos** los usuarios: no hay aquí el filtro doble
 * `id` + `user_id` de aislamiento de PEND-42 (PR-02) — es intencional, un
 * job de mantenimiento con la clave admin actúa sobre toda la tabla por
 * diseño, no en nombre de un usuario concreto.
 */
@Injectable()
export class SessionSweeperRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Sesiones `active`, las más antiguas primero: si `limit` (ver
   * `SESSION_SWEEPER_BATCH_LIMIT` en `session-sweeper.service.ts`) corta la
   * lista, así no son siempre las mismas sesiones nuevas las que se quedan
   * sin barrer en cada ejecución.
   */
  async listActiveSessions(limit: number): Promise<ActiveSessionRow[]> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id, user_id, started_at, turns_count')
      .eq('status', 'active')
      .order('started_at', { ascending: true })
      .limit(limit);

    const rows =
      unwrapInsforge<
        Array<{ id: string; user_id: string; started_at: string; turns_count: number }>
      >(result) ?? [];

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      startedAt: row.started_at,
      turnsCount: row.turns_count,
    }));
  }

  /**
   * `created_at` del turno de mayor `idx` de la sesión (SPEC-04 §6:
   * «`lastTurnAt` = `created_at` del turno de mayor `idx` de la sesión»).
   * `null` si la sesión todavía no tiene ningún turno (una apertura que
   * revienta entre el INSERT de `sessions` y el de `turns[0]`, ver
   * `SessionsRepository.deleteSession`): quien llama usa `started_at` en ese
   * caso, tal y como pide la spec («o `started_at` si no tiene ninguna»).
   */
  async findLastTurnCreatedAt(sessionId: string): Promise<string | null> {
    const result = await this.admin.database
      .from(TABLES.turns)
      .select('created_at')
      .eq('session_id', sessionId)
      .order('idx', { ascending: false })
      .limit(1)
      .maybeSingle();

    return unwrapInsforge<{ created_at: string }>(result)?.created_at ?? null;
  }

  /**
   * Marca una sesión `abandoned` sin pasar por `close_session` (SPEC-04 §6,
   * rama sin XP): `xp_earned` se queda en el `0` por defecto y no se toca
   * `profiles.streak`. `brief_job_status='done'` porque una sesión
   * `abandoned` nunca encola `coaching-brief` (ver PEND-6x de
   * docs/specs/pendientes/PR-04.md): sin eso se quedaría en `'pending'` para
   * siempre, su valor por defecto desde que se creó la sesión.
   *
   * Filtro `status='active'` además de `id`: si entre leer el lote
   * (`listActiveSessions`) y este `UPDATE` la sesión ya se cerró por otra vía
   * (el usuario la cerró a mano, o el propio barrido la procesó dos veces en
   * ejecuciones solapadas), la fila ya no cumple `status='active'` y el
   * `UPDATE` no toca nada — quien la cerró primero ya dejó el estado
   * correcto.
   */
  async markAbandoned(sessionId: string, durationSec: number, endedAtIso: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .update({
        status: 'abandoned',
        ended_at: endedAtIso,
        duration_sec: durationSec,
        brief_job_status: 'done',
      })
      .eq('id', sessionId)
      .eq('status', 'active');

    unwrapInsforge(result);
  }
}
