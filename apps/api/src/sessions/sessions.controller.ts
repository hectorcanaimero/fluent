import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { TURNS_THROTTLE } from '../rate-limit/rate-limit.constants.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CreateTurnDto } from './dto/create-turn.dto.js';
import { SessionsService } from './sessions.service.js';
import type { CreateSessionResultDto, TurnResultDto } from './sessions.types.js';
import { TurnsService } from './turns.service.js';

/**
 * `POST /sessions` (SPEC-02 §4.3, SPEC-04 §3).
 *
 * El controlador no lleva prefijo: `setGlobalPrefix('v1')` en `main.ts` (y en
 * los e2e) añade el `v1`, y las rutas se escriben completas, igual que en
 * `MemoryController`.
 *
 * `POST /sessions` responde `201`, el código por defecto de Nest para `@Post`
 * (coherente con PEND-16 de docs/specs/pendientes/PR-02.md);
 * `POST /sessions/:id/turns` responde `200` explícito, porque no crea un
 * recurso que la app pueda direccionar y `apps/mobile` espera un cuerpo
 * `TurnResult`. El resto de rutas de sesión (`/end`, `/suggestions`, listado y
 * detalle) llegan en T3, y el streaming en T4.
 */
@ApiTags('Sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly turnsService: TurnsService,
  ) {}

  @Post('sessions')
  createSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<CreateSessionResultDto> {
    return this.sessionsService.openSession(userId, dto);
  }

  /**
   * `POST /sessions/:id/turns` (SPEC-02 §4.3 y §7, SPEC-04 §4).
   *
   * `@Throttle(TURNS_THROTTLE)` estrecha **solo aquí** el throttler nombrado
   * `'turns'` a las 20 peticiones/minuto de SPEC-02 §7; el resto de rutas se
   * quedan con su límite holgado por defecto y con el general de 60/min (ver
   * `rate-limit.constants.ts` y PEND-22 de docs/specs/pendientes/PR-02.md).
   * El `429` sale con el cuerpo de SPEC-02 §6 (`RATE_LIMITED`) porque
   * `UserThrottlerGuard` lanza una `ApiException`.
   */
  @Throttle(TURNS_THROTTLE)
  @Post('sessions/:id/turns')
  @HttpCode(200)
  addTurn(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: CreateTurnDto,
  ): Promise<TurnResultDto> {
    return this.turnsService.addTurn(userId, sessionId, dto);
  }
}
