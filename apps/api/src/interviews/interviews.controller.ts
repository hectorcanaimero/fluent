import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
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
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get('interviews/quota')
  quota(@CurrentUser('id') userId: string): Promise<InterviewQuotaDto> {
    return this.interviewsService.getQuota(userId);
  }

  @Post('interviews')
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInterviewDto,
  ): Promise<InterviewDto> {
    return this.interviewsService.create(userId, dto);
  }

  @Get('interviews')
  list(@CurrentUser('id') userId: string): Promise<InterviewListResultDto> {
    return this.interviewsService.list(userId);
  }

  @Get('interviews/:id')
  detail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<InterviewDetailDto> {
    return this.interviewsService.detail(userId, id);
  }

  /** `200` explícito: no crea un recurso nuevo direccionable (mismo criterio que `sessions/:id/end`). */
  @Post('interviews/:id/retry')
  @HttpCode(200)
  retry(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<InterviewDto> {
    return this.interviewsService.retry(userId, id);
  }
}
