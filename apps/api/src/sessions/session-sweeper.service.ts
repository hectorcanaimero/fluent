import { Logger } from '@nestjs/common';

import { ABANDON_AFTER_SEC, MIN_SESSION_SEC, SESSION_HARD_CAP_SEC } from '../config/product.js';
import type { SessionSweeper, SessionSweeperResult } from '../jobs/session-sweeper.js';
import { SessionCloserService } from './session-closer.service.js';
import { SessionSweeperRepository, type ActiveSessionRow } from './session-sweeper.repository.js';

/**
 * `SessionSweeperService.run()` — job `session-sweeper` (SPEC-04 §6,
 * SPEC-05 §5, docs/tasks/PR-04-sesion.md T5), cron cada minuto.
 *
 * Para cada sesión `active`, con `elapsed = now - started_at`, `lastTurnAt`
 * = `created_at` del turno de mayor `idx` (o `started_at` si no tiene
 * ninguno) e `idle = now - lastTurnAt`:
 *
 * 1. **Abandono primero** (`idle >= ABANDON_AFTER_SEC`): con
 *    `conversationSec = min(SESSION_HARD_CAP_SEC, lastTurnAt - started_at)`,
 *    si `turns_count >= 2` y `conversationSec >= MIN_SESSION_SEC` se cierra
 *    como `ended` **con XP** (SPEC-04 §6: «para no castigar un cierre de
 *    app»); si no, se marca `abandoned` sin XP ni streak.
 * 2. **Hard cap después** (`elapsed >= SESSION_HARD_CAP_SEC`): se cierra
 *    como `ended` con XP, acotado al hard cap (SPEC-04 §5.1).
 * 3. En cualquier otro caso, la sesión se deja como está.
 *
 * **Por qué el abandono va primero:** `ABANDON_AFTER_SEC` (1800 s) es mayor
 * que `SESSION_HARD_CAP_SEC` (720 s). Si se comprobara el hard cap primero,
 * la rama de abandono de SPEC-04 §2 y §6 sería inalcanzable — toda sesión
 * activa habría cruzado ya el hard cap (720 s) mucho antes de llegar a los
 * 1800 s de inactividad, así que siempre se cerraría por hard cap y nunca se
 * marcaría `abandoned`. Además, la duración honesta de una sesión que se
 * quedó abierta (el usuario cerró la app sin avisar) es la que llega hasta
 * su último turno, no hasta el momento en que el barrido la encontró: por
 * eso `conversationSec` se mide contra `lastTurnAt`, no contra `now`.
 *
 * Comparte la RPC `close_session` y la decisión del `coaching-brief` con
 * `EndSessionService` (PR-04/T3) a través de `SessionCloserService`
 * (`decideBrief: true` siempre: el barrido solo procesa sesiones que sabe
 * `active` en el momento de leerlas, así que cada cierre es la primera vez
 * que esa sesión concreta deja de estarlo).
 *
 * Clase pura (sin decorador de Nest), mismo patrón que `RetentionService`
 * (`src/jobs/maintenance/retention.service.ts`): se construye con un
 * `useFactory` en `session-sweeper.module.ts` para poder inyectar un reloj
 * (`now`) de mentira en los tests sin mockear `Date` globalmente.
 */
export interface SessionSweeperServiceOptions {
  readonly repository: SessionSweeperRepository;
  readonly closer: SessionCloserService;
  /** Reloj inyectable para que los tests fijen "ahora". Por defecto `() => new Date()`. */
  readonly now?: () => Date;
  readonly batchLimit?: number;
}

/**
 * Sesiones `active` que se procesan por ejecución. El cron corre cada minuto
 * (SPEC-05 §1) y cada iteración hace, por sesión, una RPC de cierre como
 * mucho — nada remotamente costoso —, pero un lote sin límite dejaría al
 * barrido a merced de cuántas sesiones activas haya en un momento dado (en
 * el peor caso, todos los usuarios conectados a la vez). 200 es un margen
 * amplio para el tamaño esperado de la base de usuarios y dista mucho de
 * saturar un minuto de trabajo; si algún día no alcanza, las sesiones que se
 * queden fuera del lote de esta ejecución se recogen en la siguiente (el
 * lote prioriza las `started_at` más antiguas, ver
 * `SessionSweeperRepository.listActiveSessions`). No está en SPEC-04 ni
 * SPEC-05: decisión de esta tarea, ver docs/specs/pendientes/PR-04.md.
 */
export const SESSION_SWEEPER_BATCH_LIMIT = 200;

type SweepOutcome = 'hardCap' | 'abandonedWithXp' | 'abandoned' | 'none';

export class SessionSweeperService implements SessionSweeper {
  private readonly logger = new Logger(SessionSweeperService.name);
  private readonly repository: SessionSweeperRepository;
  private readonly closer: SessionCloserService;
  private readonly now: () => Date;
  private readonly batchLimit: number;

  constructor(options: SessionSweeperServiceOptions) {
    this.repository = options.repository;
    this.closer = options.closer;
    this.now = options.now ?? (() => new Date());
    this.batchLimit = options.batchLimit ?? SESSION_SWEEPER_BATCH_LIMIT;
  }

  async run(): Promise<SessionSweeperResult> {
    const nowDate = this.now();
    const sessions = await this.repository.listActiveSessions(this.batchLimit);

    let closedByHardCap = 0;
    let closedAsAbandoned = 0;
    let markedAbandoned = 0;

    for (const session of sessions) {
      try {
        const outcome = await this.sweepOne(session, nowDate);
        switch (outcome) {
          case 'hardCap':
            closedByHardCap++;
            break;
          case 'abandonedWithXp':
            closedAsAbandoned++;
            break;
          case 'abandoned':
            markedAbandoned++;
            break;
          case 'none':
            break;
        }
      } catch (error) {
        // Un fallo en una sesión no puede abortar el barrido entero: se
        // registra y se sigue con las demás (docs/tasks/PR-04-sesion.md T5).
        this.logger.warn(
          `session-sweeper: fallo al procesar la sesión ${session.id}: ${(error as Error).message}`,
        );
      }
    }

    return { closedByHardCap, closedAsAbandoned, markedAbandoned };
  }

  private async sweepOne(session: ActiveSessionRow, nowDate: Date): Promise<SweepOutcome> {
    const nowIso = nowDate.toISOString();
    const lastTurnAtIso =
      (await this.repository.findLastTurnCreatedAt(session.id)) ?? session.startedAt;

    const idleSec = secondsBetween(lastTurnAtIso, nowIso);

    // 1. Abandono primero (ver cabecera del archivo: por qué antes que el hard cap).
    if (idleSec >= ABANDON_AFTER_SEC) {
      const conversationSec = Math.min(
        SESSION_HARD_CAP_SEC,
        secondsBetween(session.startedAt, lastTurnAtIso),
      );

      if (session.turnsCount >= 2 && conversationSec >= MIN_SESSION_SEC) {
        await this.closer.close({
          userId: session.userId,
          sessionId: session.id,
          durationSec: conversationSec,
          turnsCount: session.turnsCount,
          decideBrief: true,
        });
        return 'abandonedWithXp';
      }

      await this.repository.markAbandoned(session.id, conversationSec, nowIso);
      return 'abandoned';
    }

    // 2. Hard cap después.
    const elapsedSec = secondsBetween(session.startedAt, nowIso);
    if (elapsedSec >= SESSION_HARD_CAP_SEC) {
      await this.closer.close({
        userId: session.userId,
        sessionId: session.id,
        durationSec: SESSION_HARD_CAP_SEC,
        turnsCount: session.turnsCount,
        decideBrief: true,
      });
      return 'hardCap';
    }

    // 3. Ni una cosa ni la otra: se deja como está.
    return 'none';
  }
}

/** Diferencia en segundos entre dos ISO 8601, nunca negativa. */
function secondsBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
}
