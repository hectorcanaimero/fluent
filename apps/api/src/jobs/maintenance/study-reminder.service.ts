/**
 * Job `study-reminder` (cola `maintenance`, cron horario; F13.1.T2, FR-30).
 *
 * BullMQ solo sabe de UTC, pero el aviso es a las 18:00 **de cada usuario**:
 * el cron corre cada hora y esta clase filtra, en cada corrida, los ciclos
 * cuyo dueño está ahora mismo a las 18:00 local. Para esos ciclos `active`,
 * si la última sesión hecha fue ayer (local) y queda una siguiente por
 * hacer, push `notifyStudyReminder` — a lo sumo una vez por día y nunca dos
 * días seguidos, guardando en Redis la fecha (local) del último envío por
 * entrevista.
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
import { type ActiveStudyCycleRow, MaintenanceRepository } from './maintenance.repository.js';

/** SPEC F13.1.T2: «hora 18:00 en la zona del usuario». */
const REMINDER_LOCAL_HOUR = 18;
/** Suficiente para que la comprobación «ayer» de la corrida siguiente siga encontrando la clave. */
const LAST_SENT_TTL_SEC = 3 * 24 * 3600;

export interface StudyReminderJobResult {
  readonly status: 'done';
  /** Ciclos cuyo usuario está ahora a las 18:00 local, con la sesión de ayer sin continuar hoy. */
  readonly candidates: number;
  /** De esos, a cuántos se les mandó el push (los demás ya se avisaron hoy o ayer). */
  readonly sent: number;
}

function localDay(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function localHour(timeZone: string, at: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at),
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
    const cycles = await this.repository.listActiveStudyCycles();
    if (cycles.length === 0) return { status: 'done', candidates: 0, sent: 0 };

    const timezones = await this.repository.loadTimezones([
      ...new Set(cycles.map((cycle) => cycle.userId)),
    ]);

    let candidates = 0;
    let sent = 0;
    for (const cycle of cycles) {
      const timezone = timezones.get(cycle.userId) ?? 'UTC';
      if (localHour(timezone, now) !== REMINDER_LOCAL_HOUR) continue;
      if (!this.isEligible(cycle, timezone, now)) continue;

      candidates += 1;
      if (await this.trySend(cycle, timezone, now)) sent += 1;
    }

    this.logger.debug(`study-reminder: ${candidates} candidato(s), ${sent} enviado(s)`);
    return { status: 'done', candidates, sent };
  }

  /** Última sesión hecha ayer (local) y queda una siguiente por hacer. */
  private isEligible(cycle: ActiveStudyCycleRow, timezone: string, now: Date): boolean {
    const next = cycle.sessions.find((session) => session.doneAt === null);
    const lastDone = [...cycle.sessions].reverse().find((session) => session.doneAt !== null);
    if (next === undefined || lastDone === undefined) return false;

    const yesterday = localDay(timezone, new Date(now.getTime() - 24 * 3600 * 1000));
    return localDay(timezone, new Date(lastDone.doneAt!)) === yesterday;
  }

  /** `false` si ya se avisó hoy o ayer (máximo uno por día, nunca dos seguidos). */
  private async trySend(cycle: ActiveStudyCycleRow, timezone: string, now: Date): Promise<boolean> {
    const today = localDay(timezone, now);
    const yesterday = localDay(timezone, new Date(now.getTime() - 24 * 3600 * 1000));
    const key = lastSentKey(cycle.interviewId);
    const lastSent = await this.redis.get(key);
    if (lastSent === today || lastSent === yesterday) return false;

    const next = cycle.sessions.find((session) => session.doneAt === null);
    if (next === undefined) return false;

    await this.push.notifyStudyReminder(cycle.userId, cycle.interviewId, next.idx, STUDY_CYCLE_SIZE, next.title);
    await this.redis.set(key, today, LAST_SENT_TTL_SEC);
    return true;
  }
}
