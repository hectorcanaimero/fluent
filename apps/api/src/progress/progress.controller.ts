import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProgressService } from './progress.service.js';
import type { ProgressResultDto } from './progress.types.js';

/**
 * `GET /progress` (SPEC-02 §4.5). Exige bearer como el resto de la API
 * (guard global de PR-02/T1); no se marca `@Public()`.
 */
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('progress')
  getProgress(@CurrentUser('id') userId: string): Promise<ProgressResultDto> {
    return this.progressService.getProgress(userId);
  }
}
