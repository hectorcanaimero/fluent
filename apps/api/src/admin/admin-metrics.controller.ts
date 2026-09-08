import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';

export interface QueueMetrics {
  readonly name: string;
  readonly waiting: number;
  readonly active: number;
  readonly failed: number;
}

export interface AdminMetricsResponse {
  readonly queues: QueueMetrics[];
}

/**
 * Controlador de administración de SPEC-05 §9: métricas de colas y Bull Board.
 *
 * Solo el owner (via bearer token) puede acceder a estos endpoints.
 */
@Controller('admin')
@UseGuards(OwnerAuthGuard)
export class AdminMetricsController {
  constructor(
    @InjectQueue(QUEUE_BRIEF) private readonly briefQueue: Queue,
    @InjectQueue(QUEUE_CONTENT) private readonly contentQueue: Queue,
    @InjectQueue(QUEUE_SOCIAL) private readonly socialQueue: Queue,
    @InjectQueue(QUEUE_MAINTENANCE) private readonly maintenanceQueue: Queue,
  ) {}

  @Get('metrics')
  async metrics(): Promise<AdminMetricsResponse> {
    const queues = [
      { name: QUEUE_BRIEF, queue: this.briefQueue },
      { name: QUEUE_CONTENT, queue: this.contentQueue },
      { name: QUEUE_SOCIAL, queue: this.socialQueue },
      { name: QUEUE_MAINTENANCE, queue: this.maintenanceQueue },
    ];

    const results = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'failed',
        );
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
        };
      }),
    );

    return { queues: results };
  }
}
