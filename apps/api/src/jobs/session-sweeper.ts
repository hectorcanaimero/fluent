/**
 * Contrato del barrido de sesiones (SPEC-05 §5, job `session-sweeper`).
 *
 * PR-05/T4 no implementaba la lógica real: solo definía el contrato
 * (`SessionSweeper`), lo registraba con un `NullSessionSweeper` de relleno, y
 * programaba el cron que lo invoca. PR-04/T5 (SPEC-04 §6) ya implementó la
 * lógica real (`SessionSweeperService`, `apps/api/src/sessions/
 * session-sweeper.service.ts`) y `MaintenanceModule` importa
 * `SessionSweeperModule` (`apps/api/src/sessions/session-sweeper.module.ts`)
 * en vez de registrar `NullSessionSweeper` como provider de `SESSION_SWEEPER`
 * — exactamente como preveía este comentario, sin tocar
 * `MaintenanceProcessor` ni `maintenance.cron.ts`, que solo conocen el token.
 *
 * `NullSessionSweeper` se queda en este archivo aunque ya no sea el binding
 * por defecto de nadie: es una implementación trivial y sus propios tests
 * (`session-sweeper.spec.ts`) siguen comprobando el contrato en sí. Ver
 * PEND-27 (resuelto) de docs/specs/pendientes/PR-05.md y PEND-6x de
 * docs/specs/pendientes/PR-04.md.
 */
import { Injectable, Logger } from '@nestjs/common';

/**
 * Nombres de campo tal y como los usa `SessionSweeperService` (SPEC-04 §6,
 * PR-04/T5): un objeto tipado que `MaintenanceProcessor` puede loguear como
 * el resto de jobs (SPEC-05 §9).
 */
export interface SessionSweeperResult {
  /** Sesiones `active` cerradas por alcanzar `SESSION_HARD_CAP_SEC`. */
  readonly closedByHardCap: number;
  /** Sesiones `active` cerradas por abandono (`ABANDON_AFTER_SEC`). */
  readonly closedAsAbandoned: number;
  /** Sesiones marcadas `abandoned` sin pasar por el cierre normal. */
  readonly markedAbandoned: number;
}

export interface SessionSweeper {
  run(): Promise<SessionSweeperResult>;
}

/** Token de inyección de `SessionSweeper` (ver comentario de cabecera). */
export const SESSION_SWEEPER = Symbol('SESSION_SWEEPER');

const ZERO_RESULT: SessionSweeperResult = {
  closedByHardCap: 0,
  closedAsAbandoned: 0,
  markedAbandoned: 0,
};

/**
 * Implementación de relleno que usó `MaintenanceModule` mientras PR-04 no
 * existía: no toca ninguna sesión, solo avisa por log y devuelve un
 * resultado en ceros. Ya **no** es el binding por defecto de
 * `SESSION_SWEEPER` (lo es `SessionSweeperService`, ver comentario de
 * cabecera del archivo); se conserva aquí, sin usar, porque sigue siendo una
 * implementación válida del contrato y sus tests documentan el
 * comportamiento esperado de cualquier `SessionSweeper` de relleno.
 */
@Injectable()
export class NullSessionSweeper implements SessionSweeper {
  private readonly logger = new Logger(NullSessionSweeper.name);

  async run(): Promise<SessionSweeperResult> {
    this.logger.warn(
      'SessionSweeper aún no implementado (PR-04 pendiente); no se cerró ninguna sesión',
    );
    return ZERO_RESULT;
  }
}
