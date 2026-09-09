import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ApiErrorCode } from '../common/api-error.js';
import { SESSION_HARD_CAP_SEC, MIN_TURNS_FOR_BRIEF } from '../config/product.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import type { EndSessionDto } from './dto/end-session.dto.js';
import { EndSessionRepository } from './end-session.repository.js';
import { findOwnedSessionOrThrow } from './session-ownership.js';
import type { SessionEndResultDto } from './sessions.types.js';
import { TurnsRepository } from './turns.repository.js';

const NOT_ONBOARDED_MESSAGE = 'Completa tu perfil antes de cerrar la sesión.';
const CLOSE_FAILED_MESSAGE = 'No se pudo cerrar la sesión.';

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
 * `brief_job_status` (que ya quedó en su valor final la primera vez).
 *
 * **Un fallo al encolar no tumba el cierre** (SPEC-04 §5.3, Redis caído): se
 * registra con `Logger.warn` y la sesión queda `brief_job_status='pending'`
 * (su valor por defecto desde que se creó, migración 3) para que una
 * reentrada futura del propio job o un barrido manual la recojan; no se
 * intenta reintentar el encolado aquí.
 */
@Injectable()
export class EndSessionService {
  private readonly logger = new Logger(EndSessionService.name);

  constructor(
    private readonly turnsRepository: TurnsRepository,
    private readonly repository: EndSessionRepository,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
  ) {}

  async endSession(
    userId: string,
    sessionId: string,
    _dto: EndSessionDto,
  ): Promise<SessionEndResultDto> {
    const session = await findOwnedSessionOrThrow(this.turnsRepository, userId, sessionId);
    const wasActive = session.status === 'active';

    const durationSec = computeDurationSec(session.started_at);

    const closeResult = await this.repository.closeSession(
      {
        p_session_id: session.id,
        p_duration_sec: durationSec,
        p_turns_count: session.turns_count,
      },
      messageForRpcCode,
    );

    if (wasActive) {
      if (session.turns_count >= MIN_TURNS_FOR_BRIEF) {
        try {
          await this.jobs.enqueueCoachingBrief(session.id);
        } catch (error) {
          this.logger.warn(
            `No se pudo encolar coaching-brief para la sesión ${session.id}: ` +
              `${(error as Error).message}`,
          );
        }
      } else {
        await this.repository.markBriefDone(userId, session.id);
      }
    }

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

/** Mensajes en español fijo (mismo criterio que el resto del módulo, PEND-29/PEND-43 de PR-02). */
function messageForRpcCode(code: ApiErrorCode): string {
  return code === 'NOT_ONBOARDED' ? NOT_ONBOARDED_MESSAGE : CLOSE_FAILED_MESSAGE;
}
