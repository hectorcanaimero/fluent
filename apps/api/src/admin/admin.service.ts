import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { OwnerService } from '../common/owner.service.js';
import { AdminRepository } from './admin.repository.js';
import { QueueMetricsService } from './queue-metrics.service.js';
import {
  aggregateSessionsPerDay,
  calculateAvgDurationSec,
  calculateLlmFailureRate,
} from './metrics-aggregation.js';
import type { AdminMetricsDto, UserPlanDto } from './admin.types.js';
import type { UpdateUserPlanDto } from './dto/update-user-plan.dto.js';

/**
 * `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2).
 *
 * Solo owner. Devuelve, en una sola respuesta, las cuatro métricas de
 * RF-8.2 (últimos 14 días para las tres primeras):
 * - Sesiones por día
 * - Duración media
 * - Tasa de fallo de LLM
 * - Jobs pendientes: contadores de las 4 colas de BullMQ (SPEC-05 §9), que
 *   aporta `QueueMetricsService` (antes `AdminMetricsController` de PR-05).
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly ownerService: OwnerService,
    private readonly adminRepository: AdminRepository,
    private readonly queueMetricsService: QueueMetricsService,
  ) {}

  /**
   * Trae las métricas del operador. Requiere ser el owner del sistema.
   */
  async getMetrics(userId: string, now: Date = new Date()): Promise<AdminMetricsDto> {
    // Solo el owner del sistema.
    if (!this.ownerService.isSystemOwner(userId)) {
      throw ApiException.forbidden('Solo el owner del sistema puede acceder a esta sección.');
    }

    const [sessionRows, durationRows, llmCallRows, queues] = await Promise.all([
      this.adminRepository.listRecentSessions(now),
      this.adminRepository.listRecentEndedSessions(now),
      this.adminRepository.listRecentLlmCalls(now),
      this.queueMetricsService.list(),
    ]);

    const sessionsPerDay = aggregateSessionsPerDay(sessionRows, now);
    const avgDurationSec = calculateAvgDurationSec(durationRows);
    const { rate, total, failed } = calculateLlmFailureRate(llmCallRows);

    return {
      sessionsPerDay,
      avgDurationSec,
      llmFailureRate: rate,
      llmFailureRateTotals: { total, failed },
      queues,
    };
  }

  /** `PUT /admin/users/:id/plan`: solo owner del sistema; 404 si el usuario no existe. */
  async setUserPlan(
    actorId: string,
    targetUserId: string,
    dto: UpdateUserPlanDto,
  ): Promise<UserPlanDto> {
    if (!this.ownerService.isSystemOwner(actorId)) {
      throw ApiException.forbidden('Solo el owner del sistema puede acceder a esta sección.');
    }

    const row = await this.adminRepository.setPlan(
      targetUserId,
      dto.plan,
      dto.expiresAt ?? null,
    );
    if (row === null) {
      throw ApiException.of('NOT_FOUND', 'El usuario no existe.');
    }

    this.logger.log(
      `El owner ${actorId} cambió el plan de ${targetUserId} a ${row.plan} (vence: ${row.plan_expires_at ?? 'nunca'})`,
    );
    return { userId: row.user_id, plan: row.plan, planExpiresAt: row.plan_expires_at };
  }
}
