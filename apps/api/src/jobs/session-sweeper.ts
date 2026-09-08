/**
 * Contrato del barrido de sesiones (SPEC-05 §5, job `session-sweeper`).
 *
 * PR-04 (sesión de conversación) todavía no existe en esta rama, y es quien
 * implementará la lógica real de barrido (`docs/tasks/PR-04-sesion.md` T5:
 * «SessionSweeperService.run() según SPEC-04 §6, expuesto para que PR-05 lo
 * programe»). PR-05/T4 no implementa esa lógica: solo define el contrato
 * (`SessionSweeper`), lo registra con un `NullSessionSweeper` de relleno, y
 * programa el cron que lo invoca.
 *
 * Cuando PR-04 exista, sustituye el provider por defecto
 * (`{ provide: SESSION_SWEEPER, useClass: NullSessionSweeper }` en
 * `maintenance.module.ts`) por el suyo propio — por ejemplo reexportando
 * `{ provide: SESSION_SWEEPER, useClass: RealSessionSweeperService }` desde
 * su propio módulo e importándolo en `MaintenanceModule` en vez del actual
 * provider, o sobreescribiendo el binding con `.overrideProvider` en el
 * árbol de módulos del worker — sin tocar `MaintenanceProcessor` ni
 * `maintenance.cron.ts`, que solo conocen el token `SESSION_SWEEPER`.
 *
 * Ver PEND-24 de docs/specs/pendientes/PR-05.md.
 */
import { Injectable, Logger } from '@nestjs/common';

/**
 * Los nombres de los campos son orientativos (SPEC-04 §6 aún no existe en
 * esta rama): lo importante es que el resultado sea un objeto tipado que
 * `MaintenanceProcessor` pueda loguear como el resto de jobs (SPEC-05 §9).
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
 * Implementación de relleno mientras PR-04 no exista: no toca ninguna
 * sesión, solo avisa por log y devuelve un resultado en ceros. Así el cron
 * `session-sweeper` (cada minuto) puede registrarse y ejecutarse desde ya sin
 * romper nada ni depender de una tabla/columna que PR-04 todavía no definió.
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
