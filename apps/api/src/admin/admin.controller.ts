import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import type { AdminMetricsDto } from './admin.types.js';

/**
 * Endpoints administrativos (SPEC-02 §4.6).
 * Todos requieren bearer (guard global); algunos adicionales requieren ser owner.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2, SPEC-05 §9).
   *
   * Solo owner del sistema (401 lo da el `AuthGuard` global, 403 lo da
   * `AdminService` con `OwnerService`). Devuelve las métricas de producto de
   * los últimos 14 días **y** los contadores de las 4 colas de BullMQ: es el
   * único `GET /admin/metrics` del repo tras fusionar PR-05
   * (docs/specs/pendientes/PR-02.md PEND-73).
   */
  @Get('metrics')
  getMetrics(@CurrentUser('id') userId: string): Promise<AdminMetricsDto> {
    return this.adminService.getMetrics(userId);
  }
}
