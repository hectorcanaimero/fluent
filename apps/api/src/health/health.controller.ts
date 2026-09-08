import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

// SPEC-02 §4: «Todos requieren bearer salvo `/health`». `@Public()` sobre
// la clase exime a todo el controlador del AuthGuard global.
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
