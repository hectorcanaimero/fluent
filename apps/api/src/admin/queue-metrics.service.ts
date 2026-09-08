import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';

/** Contadores de una cola de BullMQ (SPEC-05 §9). */
export interface QueueMetrics {
  readonly name: string;
  readonly waiting: number;
  readonly active: number;
  readonly failed: number;
}

/**
 * Contadores de las 4 colas de BullMQ para `GET /admin/metrics`
 * («jobs pendientes» de RF-8.2, SPEC-05 §9).
 *
 * Era el cuerpo del `AdminMetricsController` de PR-05; al fusionar PR-05 en
 * PR-02 quedaban dos controladores sirviendo la misma ruta (uno con las
 * métricas de producto de SPEC-02 §4.6 y otro con las colas), así que la
 * lectura de colas se extrajo a este servicio y `AdminService` la compone con
 * el resto de métricas en una sola respuesta. Ver
 * docs/specs/pendientes/PR-02.md PEND-73.
 */
@Injectable()
export class QueueMetricsService {
  private readonly queues: readonly { name: string; queue: Queue }[];

  constructor(
    @InjectQueue(QUEUE_BRIEF) briefQueue: Queue,
    @InjectQueue(QUEUE_CONTENT) contentQueue: Queue,
    @InjectQueue(QUEUE_SOCIAL) socialQueue: Queue,
    @InjectQueue(QUEUE_MAINTENANCE) maintenanceQueue: Queue,
  ) {
    this.queues = [
      { name: QUEUE_BRIEF, queue: briefQueue },
      { name: QUEUE_CONTENT, queue: contentQueue },
      { name: QUEUE_SOCIAL, queue: socialQueue },
      { name: QUEUE_MAINTENANCE, queue: maintenanceQueue },
    ];
  }

  /** Un elemento por cola, siempre en el mismo orden. */
  async list(): Promise<QueueMetrics[]> {
    return Promise.all(
      this.queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts('waiting', 'active', 'failed');
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
        };
      }),
    );
  }
}
