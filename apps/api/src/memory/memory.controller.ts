import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PatchFactDto } from './dto/patch-fact.dto.js';
import { PutBriefDto } from './dto/put-brief.dto.js';
import { MemoryService } from './memory.service.js';
import type { CoachingBriefDto, MemoryFactDto, MemoryResultDto } from './memory.types.js';

/**
 * `GET /memory`, `PATCH /memory/facts/:id`, `DELETE /memory/facts/:id`,
 * `PUT /memory/brief`, `DELETE /memory` (SPEC-02 §4.4).
 *
 * Todas exigen bearer (guard global de PR-02/T1); ninguna se marca
 * `@Public()`.
 */
@ApiTags('Memory')
@ApiBearerAuth()
@Controller()
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get('memory')
  getMemory(@CurrentUser('id') userId: string): Promise<MemoryResultDto> {
    return this.memoryService.getMemory(userId);
  }

  @Patch('memory/facts/:id')
  patchFact(
    @CurrentUser('id') userId: string,
    @Param('id') factId: string,
    @Body() dto: PatchFactDto,
  ): Promise<MemoryFactDto> {
    return this.memoryService.patchFact(userId, factId, dto.status, dto.text);
  }

  @Delete('memory/facts/:id')
  @HttpCode(204)
  async deleteFact(
    @CurrentUser('id') userId: string,
    @Param('id') factId: string,
  ): Promise<void> {
    await this.memoryService.deleteFact(userId, factId);
  }

  @Put('memory/brief')
  putBrief(
    @CurrentUser('id') userId: string,
    @Body() dto: PutBriefDto,
  ): Promise<CoachingBriefDto> {
    return this.memoryService.putBrief(userId, dto.text);
  }

  @Delete('memory')
  @HttpCode(204)
  async deleteAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.memoryService.deleteAll(userId);
  }
}
