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
   * `GET /admin/metrics` (SPEC-02 §4.6, RF-8.2).
   * Solo owner del sistema. Devuelve métricas de los últimos 14 días.
   */
  @Get('metrics')
  getMetrics(@CurrentUser('id') userId: string): Promise<AdminMetricsDto> {
    return this.adminService.getMetrics(userId);
  }
}
