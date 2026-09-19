import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ApiErrorCode } from '../common/api-error.js';
import type { CloseSessionResult } from '../db/rpc.js';
import { MIN_TURNS_FOR_BRIEF } from '../config/product.js';
import { JOB_DISPATCHER, type JobDispatcher } from '../jobs/job-dispatcher.js';
import { EndSessionRepository } from './end-session.repository.js';

const NOT_ONBOARDED_MESSAGE = 'Completa tu perfil antes de cerrar la sesión.';
const CLOSE_FAILED_MESSAGE = 'No se pudo cerrar la sesión.';

/** Mensajes en español fijo (mismo criterio que el resto del módulo, PEND-29/PEND-43 de PR-02). */
function messageForRpcCode(code: ApiErrorCode): string {
  return code === 'NOT_ONBOARDED' ? NOT_ONBOARDED_MESSAGE : CLOSE_FAILED_MESSAGE;
}

/** Parámetros de `SessionCloserService.close` (ver cabecera de la clase). */
export interface SessionCloseParams {
  readonly userId: string;
  readonly sessionId: string;
  /** `duration_sec` a pasar a `close_session` (ya acotado por quien llama). */
  readonly durationSec: number;
  /** `turns_count` de la sesión (turnos **del usuario**, decisión de PR-04/T1). */
  readonly turnsCount: number;
  /**
   * Si además de cerrar hay que decidir el encolado del `coaching-brief`.
   *
   * `close_session` es idempotente (docs/specs/pendientes/PR-01.md §15) y se
   * llama siempre, pero la decisión del brief solo tiene sentido la primera
   * vez que una sesión concreta pasa de `active` a `ended`/`abandoned`:
   * - `EndSessionService` pone `false` cuando la sesión ya estaba cerrada (una
   *   llamada repetida a `POST /sessions/:id/end` no debe volver a decidir el
   *   brief ni a tocar `brief_job_status`, que ya quedó en su valor final la
   *   primera vez).
   * - `SessionSweeperService` (PR-04/T5) solo cierra sesiones que sabe que
   *   están `active` en el momento de leerlas, así que siempre es `true`.
   */
  readonly decideBrief: boolean;
}

/** Resultado de `close_session` más las insignias recién ganadas. */
export interface SessionCloseResult extends CloseSessionResult {
  readonly newBadges: readonly string[];
}

/**
 * Cierre de una sesión: RPC `close_session` (SPEC-04 §5.2) + decisión del
 * encolado de `coaching-brief` (SPEC-04 §5.3, SPEC-05 §2).
 *
 * Extraído de `EndSessionService` (PR-04/T3) para que `SessionSweeperService`
 * (PR-04/T5, SPEC-04 §6) reutilice exactamente la misma lógica de cierre en
 * vez de duplicarla — el encargo explícito de la tarea T5. Vive en
 * `src/sessions/` (no en `src/jobs/`) porque es lógica de dominio de sesión,
 * no de infraestructura de colas; `SessionSweeperModule` la provee
 * directamente como "su propio repositorio" (junto a `EndSessionRepository`)
 * sin importar `SessionsModule`, para no arrastrar `LlmModule` ni
 * `SessionsController` al árbol del worker (ver `session-sweeper.module.ts`).
 */
@Injectable()
export class SessionCloserService {
  private readonly logger = new Logger(SessionCloserService.name);

  constructor(
    private readonly repository: EndSessionRepository,
    @Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcher,
  ) {}

  async close(params: SessionCloseParams): Promise<SessionCloseResult> {
    const closeResult = await this.repository.closeSession(
      {
        p_session_id: params.sessionId,
        p_duration_sec: params.durationSec,
        p_turns_count: params.turnsCount,
      },
      messageForRpcCode,
    );

    if (params.decideBrief) {
      if (params.turnsCount >= MIN_TURNS_FOR_BRIEF) {
        try {
          await this.jobs.enqueueCoachingBrief(params.sessionId);
        } catch (error) {
          // SPEC-04 §5.3: un fallo al encolar (Redis caído) no tumba el
          // cierre. La sesión queda `brief_job_status='pending'` (su valor
          // por defecto) para que una reentrada futura la recoja.
          this.logger.warn(
            `No se pudo encolar coaching-brief para la sesión ${params.sessionId}: ` +
              `${(error as Error).message}`,
          );
        }
      } else {
        await this.repository.markBriefDone(params.userId, params.sessionId);
      }
    }

    // Las insignias no pueden tumbar el cierre: si falla, la sesión queda
    // cerrada igual y la próxima llamada a `award_badges` otorga lo que falte.
    let newBadges: string[] = [];
    try {
      newBadges = await this.repository.awardBadges(params.userId, params.sessionId);
    } catch (error) {
      this.logger.warn(
        `No se pudieron otorgar insignias en la sesión ${params.sessionId}: ` +
          `${(error as Error).message}`,
      );
    }

    return { ...closeResult, newBadges };
  }
}
