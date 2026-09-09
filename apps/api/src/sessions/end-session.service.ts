import { Injectable } from '@nestjs/common';
import { SESSION_HARD_CAP_SEC } from '../config/product.js';
import type { EndSessionDto } from './dto/end-session.dto.js';
import { EndSessionRepository } from './end-session.repository.js';
import { SessionCloserService } from './session-closer.service.js';
import { findOwnedSessionOrThrow } from './session-ownership.js';
import type { SessionEndResultDto } from './sessions.types.js';
import { TurnsRepository } from './turns.repository.js';

/**
 * `POST /sessions/:id/end` (SPEC-04 §5).
 *
 * **Sesión ya cerrada → `200` con el resumen que ya tenía** (decisión de esta
 * tarea, no un `409`): `close_session` ya es idempotente
 * (docs/specs/pendientes/PR-01.md §15), y responder `200` es más útil para la
 * app que un error — el timer de la app y un cierre manual del usuario
 * pueden coincidir en una carrera y las dos peticiones deben ver el mismo
 * resumen. Ver docs/specs/pendientes/PR-04.md.
 *
 * **`reason` no se usa** más allá de la validación del DTO: `sessions` no
 * tiene columna para guardarlo y SPEC-04 §5 no le da ningún efecto.
 *
 * **El job de `coaching-brief` solo se decide si la sesión pasa de `active` a
 * `ended` en esta llamada** (`wasActive`): una llamada repetida sobre una
 * sesión ya cerrada no debe volver a encolar el job ni a tocar
 * `brief_job_status` (que ya quedó en su valor final la primera vez). La RPC
 * + esa decisión viven en `SessionCloserService` (PR-04/T5), compartido con
 * `SessionSweeperService` (SPEC-04 §6) para no duplicar la lógica de cierre.
 */
@Injectable()
export class EndSessionService {
  constructor(
    private readonly turnsRepository: TurnsRepository,
    private readonly repository: EndSessionRepository,
    private readonly closer: SessionCloserService,
  ) {}

  async endSession(
    userId: string,
    sessionId: string,
    _dto: EndSessionDto,
  ): Promise<SessionEndResultDto> {
    const session = await findOwnedSessionOrThrow(this.turnsRepository, userId, sessionId);
    const wasActive = session.status === 'active';

    const durationSec = computeDurationSec(session.started_at);

    const closeResult = await this.closer.close({
      userId,
      sessionId: session.id,
      durationSec,
      turnsCount: session.turns_count,
      decideBrief: wasActive,
    });

    const correctionsCount = await this.repository.countCorrections(session.id);

    return {
      summary: {
        xpEarned: closeResult.xp_earned,
        streak: closeResult.streak,
        isDoubleDay: closeResult.is_double_day,
        correctionsCount,
        durationSec: wasActive ? durationSec : (session.duration_sec ?? 0),
        nextIsBoss: closeResult.next_is_boss,
      },
    };
  }
}

/**
 * `duration_sec = now - started_at` (SPEC-04 §5), acotado a
 * `SESSION_HARD_CAP_SEC` y nunca negativo (un reloj desincronizado o una
 * petición retrasada no debe producir un valor absurdo).
 */
export function computeDurationSec(startedAtIso: string, now: Date = new Date()): number {
  const elapsedSec = Math.floor((now.getTime() - new Date(startedAtIso).getTime()) / 1000);
  return Math.min(SESSION_HARD_CAP_SEC, Math.max(0, elapsedSec));
}
