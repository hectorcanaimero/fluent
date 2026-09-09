import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionsService } from './sessions.service.js';
import type { CreateSessionResultDto } from './sessions.types.js';

/**
 * `POST /sessions` (SPEC-02 §4.3, SPEC-04 §3).
 *
 * El controlador no lleva prefijo: `setGlobalPrefix('v1')` en `main.ts` (y en
 * los e2e) añade el `v1`, y las rutas se escriben completas, igual que en
 * `MemoryController`.
 *
 * Responde `201`, el código por defecto de Nest para `@Post` (coherente con
 * PEND-16 de docs/specs/pendientes/PR-02.md). El resto de rutas de sesión
 * (`/turns`, `/end`, `/suggestions`, listado y detalle) llegan en T2 y T3.
 */
@ApiTags('Sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('sessions')
  createSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<CreateSessionResultDto> {
    return this.sessionsService.openSession(userId, dto);
  }
}
