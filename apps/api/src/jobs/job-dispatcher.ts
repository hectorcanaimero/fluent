/**
 * Contrato de encolado (SPEC-05 §1 y §2).
 *
 * Es lo único que la API HTTP necesita saber de las colas: PR-04/T3 inyecta
 * `JOB_DISPATCHER` en el endpoint `POST /sessions/:id/end` y llama a
 * `enqueueCoachingBrief(sessionId)`. Así el paquete de la API no arrastra
 * `bullmq` ni los procesadores, y los tests de PR-04 pueden sustituirlo por
 * un doble sin Redis.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import {
  JOB_COACHING_BRIEF,
  JOB_INTERVIEW_PREPARE,
  QUEUE_BRIEF,
  QUEUE_INTERVIEWS,
} from './jobs.constants.js';

/** Carga de un job `coaching-brief` (SPEC-05 §2: «Entrada: `{ sessionId }`»). */
export interface CoachingBriefJobData {
  readonly sessionId: string;
}

/** Carga de un job `interview-prepare` (F10.3, arch 003 §Components C3). */
export interface InterviewPrepareJobData {
  readonly interviewId: string;
}

export interface JobDispatcher {
  /**
   * Encola el cierre de sesión. Idempotente: si ya hay un job para esa sesión
   * en espera, retrasado o activo, BullMQ ignora el `add` en silencio porque
   * se usa `jobId = sessionId`.
   */
  enqueueCoachingBrief(sessionId: string): Promise<void>;

  /**
   * Encola la preparación de una entrevista (`POST /interviews` y
   * `POST /interviews/:id/retry`, F10.3). Mismo criterio de idempotencia que
   * `enqueueCoachingBrief`: `jobId = interviewId`.
   */
  enqueueInterviewPrepare(interviewId: string): Promise<void>;
}

/** Token de inyección. `QueuesModule` (global) lo provee. */
export const JOB_DISPATCHER = Symbol('JOB_DISPATCHER');

@Injectable()
export class BullJobDispatcher implements JobDispatcher {
  private readonly logger = new Logger(BullJobDispatcher.name);

  constructor(
    @InjectQueue(QUEUE_BRIEF) private readonly briefQueue: Queue,
    @InjectQueue(QUEUE_INTERVIEWS) private readonly interviewsQueue: Queue,
  ) {}

  async enqueueCoachingBrief(sessionId: string): Promise<void> {
    // `jobId = sessionId`: si el endpoint se reintenta, o si el sweeper vuelve
    // a encolar la misma sesión, BullMQ descarta el duplicado mientras el job
    // siga vivo (waiting/delayed/active). Cuando el job ya terminó y se
    // limpió, un `add` posterior sí crea un job nuevo, y la idempotencia la
    // garantiza entonces `sessions.brief_job_status = 'done'` (SPEC-05 §2 y
    // la propia función SQL `apply_brief`).
    await this.briefQueue.add(
      JOB_COACHING_BRIEF,
      { sessionId } satisfies CoachingBriefJobData,
      { jobId: sessionId },
    );
    this.logger.debug(`coaching-brief encolado para la sesión ${sessionId}`);
  }

  async enqueueInterviewPrepare(interviewId: string): Promise<void> {
    // Mismo criterio que `enqueueCoachingBrief`: `jobId = interviewId` evita
    // duplicar el job mientras siga vivo; `POST /interviews/:id/retry` vuelve
    // a encolar sin problema porque el intento anterior ya terminó
    // (`prep_failed`, F10.3.T3).
    await this.interviewsQueue.add(
      JOB_INTERVIEW_PREPARE,
      { interviewId } satisfies InterviewPrepareJobData,
      { jobId: interviewId },
    );
    this.logger.debug(`interview-prepare encolado para la entrevista ${interviewId}`);
  }
}

/** Token opcional para tests: implementación que no hace nada. */
export const NOOP_JOB_DISPATCHER: JobDispatcher = {
  enqueueCoachingBrief: async () => {},
  enqueueInterviewPrepare: async () => {},
};
