import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { OwnerService } from '../common/owner.service.js';
import { AdminRepository } from './admin.repository.js';
import {
  aggregateSessionsPerDay,
  calculateAvgDurationSec,
  calculateLlmFailureRate,
} from './metrics-aggregation.js';
import type { AdminMetricsDto } from './admin.types.js';

/**
 * `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2).
 *
 * Solo owner. Devuelve métricas del sistema de los últimos 14 días:
 * - Sesiones por día
 * - Duración media
 * - Tasa de fallo de LLM
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly adminRepository: AdminRepository,
  ) {}

  /**
   * Trae las métricas del operador. Requiere ser el owner del sistema.
   */
  async getMetrics(userId: string, now: Date = new Date()): Promise<AdminMetricsDto> {
    // Solo el owner del sistema.
    if (!this.ownerService.isSystemOwner(userId)) {
      throw ApiException.forbidden('Solo el owner del sistema puede acceder a esta sección.');
    }

    const [sessionRows, durationRows, llmCallRows] = await Promise.all([
      this.adminRepository.listRecentSessions(now),
      this.adminRepository.listRecentEndedSessions(now),
      this.adminRepository.listRecentLlmCalls(now),
    ]);

    const sessionsPerDay = aggregateSessionsPerDay(sessionRows, now);
    const avgDurationSec = calculateAvgDurationSec(durationRows);
    const { rate, total, failed } = calculateLlmFailureRate(llmCallRows);

    return {
      sessionsPerDay,
      avgDurationSec,
      llmFailureRate: rate,
      llmFailureRateTotals: { total, failed },
    };
  }
}
