import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

// SPEC-02 §4: «Todos requieren bearer salvo `/health`». `@Public()` sobre
// la clase exime a todo el controlador del AuthGuard global.
//
// `@SkipThrottle()` (PR-02/T3, SPEC-02 §7): el healthcheck de Docker/Coolify
// llama a este endpoint cada pocos segundos; sin esto, el rate limiting
// global (60/min) lo bloquearía con 429 en cuestión de un minuto y tumbaría
// el propio healthcheck. Sin argumentos salta **todos** los throttlers
// nombrados (`default` y `turns`), que es lo que se quiere: `/health` no
// debe tener ningún límite.
@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness (MEJ-27): 200 mientras el proceso responda, aunque Redis o
   * InsForge estén caídos. Es el que mira el HEALTHCHECK del contenedor.
   */
  @Get()
  async check(): Promise<HealthStatus> {
    return this.healthService.check();
  }

  /**
   * Readiness (MEJ-27): 200 solo con Redis e InsForge arriba, 503 si no.
   * Para decidir si mandarle tráfico, no si reiniciar el contenedor.
   */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const status = await this.healthService.ready();
    res.status(status.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return status;
  }
}
