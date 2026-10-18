/**
 * Job `study-reminder` (cola `maintenance`, cron horario; F13.1.T2, FR-30).
 *
 * BullMQ solo sabe de UTC, pero el aviso es a las 18:00 **de cada usuario**:
 * el cron corre cada hora y esta clase filtra, en cada corrida, los dueños de
 * ciclos activos que están ahora mismo a las 18:00 local, y solo carga los
 * ciclos (con sus sesiones) de esos usuarios. Para esos ciclos `active`,
 * si la última sesión hecha fue ayer (local) y queda una siguiente por
 * hacer, push `notifyStudyReminder` — a lo sumo una vez por día y nunca dos
 * días seguidos, guardando en Redis la fecha (local) del último envío
 * **real** por entrevista (si el push no salió, no cuenta ni se guarda).
 *
 * ponytail: sin RPC propio en Postgres (esta tarea no trae migración); el
 * filtro de candidatos y la hora local se calculan en memoria, aceptable
 * para el tamaño de este proyecto (igual que ya documentan
 * `retention.service.ts` y `deleteTurnsForSessionsStartedBefore` en
 * `maintenance.repository.ts`). Subir a una función SQL si el número de
 * ciclos activos crece mucho.
 */
import { Injectable, Logger } from '@nestjs/common';

import { STUDY_CYCLE_SIZE } from '../../interviews/interviews.repository.js';
import { PushService } from '../../push/push.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { safeTimeZone, userDay } from '../../sessions/user-day.js';
import {
  type ActiveStudyCycleRow,
  type ActiveStudyCycleSessionRow,
  MaintenanceRepository,
} from './maintenance.repository.js';

/** SPEC F13.1.T2: «hora 18:00 en la zona del usuario». */
const REMINDER_LOCAL_HOUR = 18;
/** Suficiente para que la comprobación «ayer» de la corrida siguiente siga encontrando la clave. */
const LAST_SENT_TTL_SEC = 3 * 24 * 3600;
const DAY_MS = 24 * 3600 * 1000;

export interface StudyReminderJobResult {
  readonly status: 'done';
  /** Ciclos cuyo usuario está ahora a las 18:00 local, con la sesión de ayer sin continuar hoy. */
  readonly candidates: number;
  /** De esos, a cuántos les llegó el push (los demás ya se avisaron hoy o ayer, o no se pudo enviar). */
  readonly sent: number;
}

function localHour(timeZone: string | null | undefined, at: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimeZone(timeZone),
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at),
  );
}

function lastSentKey(interviewId: string): string {
  return `study-reminder:last-sent:${interviewId}`;
}

@Injectable()
export class StudyReminderService {
  private readonly logger = new Logger(StudyReminderService.name);

  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly redis: RedisService,
    private readonly push: PushService,
  ) {}

  async run(now: Date = new Date()): Promise<StudyReminderJobResult> {
    const owners = await this.repository.listActiveStudyCycleUserIds();
    if (owners.length === 0) return { status: 'done', candidates: 0, sent: 0 };

    const timezones = await this.repository.loadTimezones(owners);
    const due = owners.filter((userId) => localHour(timezones.get(userId), now) === REMINDER_LOCAL_HOUR);
    if (due.length === 0) return { status: 'done', candidates: 0, sent: 0 };

    const cycles = await this.repository.listActiveStudyCycles(due);

    let candidates = 0;
    let sent = 0;
    for (const cycle of cycles) {
      const timezone = timezones.get(cycle.userId);
      const next = this.nextIfEligible(cycle, timezone, now);
      if (next === null) continue;

      candidates += 1;
      if (await this.trySend(cycle, next, timezone, now)) sent += 1;
    }

    this.logger.debug(`study-reminder: ${candidates} candidato(s), ${sent} enviado(s)`);
    return { status: 'done', candidates, sent };
  }

  /** La siguiente sesión por hacer si la última hecha fue ayer (local); si no, `null`. */
  private nextIfEligible(
    cycle: ActiveStudyCycleRow,
    timezone: string | null | undefined,
    now: Date,
  ): ActiveStudyCycleSessionRow | null {
    const next = cycle.sessions.find((session) => session.doneAt === null);
    const lastDone = cycle.sessions.findLast((session) => session.doneAt !== null);
    if (next === undefined || lastDone?.doneAt == null) return null;

    const yesterday = userDay(timezone, new Date(now.getTime() - DAY_MS));
    return userDay(timezone, new Date(lastDone.doneAt)) === yesterday ? next : null;
  }

  /** `false` si ya se avisó hoy o ayer (máximo uno por día, nunca dos seguidos) o si el push no salió. */
  private async trySend(
    cycle: ActiveStudyCycleRow,
    next: ActiveStudyCycleSessionRow,
    timezone: string | null | undefined,
    now: Date,
  ): Promise<boolean> {
    const today = userDay(timezone, now);
    const yesterday = userDay(timezone, new Date(now.getTime() - DAY_MS));
    const key = lastSentKey(cycle.interviewId);
    const lastSent = await this.redis.get(key);
    if (lastSent === today || lastSent === yesterday) return false;

    const delivered = await this.push.notifyStudyReminder(
      cycle.userId,
      cycle.interviewId,
      next.idx,
      STUDY_CYCLE_SIZE,
      next.title,
    );
    if (!delivered) return false;
    await this.redis.set(key, today, LAST_SENT_TTL_SEC);
    return true;
  }
}
