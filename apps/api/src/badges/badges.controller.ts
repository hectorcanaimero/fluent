import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BadgesService } from './badges.service.js';
import type { BadgeDto } from './badges.types.js';

/** `GET /me/badges`: catálogo de insignias con las ganadas (ronda 4). */
@ApiTags('Me')
@ApiBearerAuth()
@Controller()
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get('me/badges')
  getBadges(@CurrentUser('id') userId: string): Promise<{ badges: BadgeDto[] }> {
    return this.badgesService.getBadges(userId);
  }
}
