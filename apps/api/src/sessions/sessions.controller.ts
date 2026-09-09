import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { TURNS_THROTTLE } from '../rate-limit/rate-limit.constants.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CreateTurnDto } from './dto/create-turn.dto.js';
import { EndSessionDto } from './dto/end-session.dto.js';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto.js';
import { EndSessionService } from './end-session.service.js';
import { SessionsHistoryService } from './sessions-history.service.js';
import { SessionsService } from './sessions.service.js';
import type {
  CreateSessionResultDto,
  SessionDetailResultDto,
  SessionEndResultDto,
  SessionListResultDto,
  SessionSuggestionsDto,
  TurnResultDto,
} from './sessions.types.js';
import { SuggestionsService } from './suggestions.service.js';
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
 * `TurnResult`. `POST /sessions/:id/end` también responde `200` explícito
 * por el mismo motivo (SPEC-04 §5). El streaming llega en T4.
 *
 * **Orden de rutas (T3):** `GET sessions/suggestions` se declara **antes**
 * que `GET sessions/:id`: Nest/Express resuelve por orden de registro, y con
 * el orden contrario `suggestions` se interpretaría como un `:id` (ver test
 * de esto en `test/session-end.e2e-spec.ts`).
 */
@ApiTags('Sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly turnsService: TurnsService,
    private readonly endSessionService: EndSessionService,
    private readonly suggestionsService: SuggestionsService,
    private readonly sessionsHistoryService: SessionsHistoryService,
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

  /** `POST /sessions/:id/end` (SPEC-02 §4.3, SPEC-04 §5). `200` explícito, ver cabecera. */
  @Post('sessions/:id/end')
  @HttpCode(200)
  endSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: EndSessionDto,
  ): Promise<SessionEndResultDto> {
    return this.endSessionService.endSession(userId, sessionId, dto);
  }

  /** `GET /sessions` (SPEC-02 §4.3): sesiones del usuario, más recientes primero. */
  @Get('sessions')
  listSessions(
    @CurrentUser('id') userId: string,
    @Query() query: ListSessionsQueryDto,
  ): Promise<SessionListResultDto> {
    return this.sessionsHistoryService.list(userId, query);
  }

  /**
   * `GET /sessions/suggestions` (SPEC-04 §7). Declarada **antes** que
   * `GET sessions/:id` (ver cabecera de la clase).
   */
  @Get('sessions/suggestions')
  suggestions(@CurrentUser('id') userId: string): Promise<SessionSuggestionsDto> {
    return this.suggestionsService.getSuggestions(userId);
  }

  /** `GET /sessions/:id` (SPEC-02 §4.3): detalle con turnos y correcciones. */
  @Get('sessions/:id')
  sessionDetail(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ): Promise<SessionDetailResultDto> {
    return this.sessionsHistoryService.detail(userId, sessionId);
  }
}
