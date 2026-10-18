import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateInterviewDto } from './dto/create-interview.dto.js';
import {
  InterviewsService,
  type InterviewDetailDto,
  type InterviewDto,
  type InterviewListResultDto,
  type InterviewQuotaDto,
} from './interviews.service.js';
import { InterviewSessionService } from './interview-session.service.js';
import type { InterviewSessionDto } from '../sessions/sessions.types.js';

/**
 * `GET /interviews/quota`, `POST /interviews`, `GET /interviews`,
 * `GET /interviews/:id`, `POST /interviews/:id/retry` (I2, F10.3.T2).
 *
 * `GET interviews/quota` se declara **antes** que `GET interviews/:id`
 * (mismo motivo que `GET sessions/suggestions` en `SessionsController`):
 * Nest/Express resuelve por orden de registro.
 */
@ApiTags('Interviews')
@ApiBearerAuth()
@Controller()
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly interviewSessions: InterviewSessionService,
  ) {}

  @Get('interviews/quota')
  quota(@CurrentUser('id') userId: string): Promise<InterviewQuotaDto> {
    return this.interviewsService.getQuota(userId);
  }

  @Post('interviews')
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInterviewDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<InterviewDto> {
    return this.interviewsService.create(userId, dto, acceptLanguage);
  }

  @Get('interviews')
  list(@CurrentUser('id') userId: string): Promise<InterviewListResultDto> {
    return this.interviewsService.list(userId);
  }

  @Get('interviews/:id')
  detail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<InterviewDetailDto> {
    return this.interviewsService.detail(userId, id, acceptLanguage);
  }

  /** `200` explícito: no crea un recurso nuevo direccionable (mismo criterio que `sessions/:id/end`). */
  @Post('interviews/:id/retry')
  @HttpCode(200)
  retry(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<InterviewDto> {
    return this.interviewsService.retry(userId, id, acceptLanguage);
  }

  /** Abre (`ready`) o retoma (`in_progress`/`too_short`) la sesión de la entrevista (FR-25). */
  @Post('interviews/:id/session')
  @HttpCode(200)
  openSession(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<InterviewSessionDto> {
    return this.interviewSessions.open(userId, id, acceptLanguage);
  }
}
