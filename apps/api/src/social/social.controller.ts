import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ChallengesService } from './challenges.service.js';
import { WeekQueryDto } from './dto/week-query.dto.js';
import { LeaderboardService } from './leaderboard.service.js';
import type { ChallengesResultDto, LeaderboardResultDto, WeeklySummaryResultDto } from './social.types.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

/**
 * `GET /leaderboard`, `GET /challenges`, `GET /weekly-summary` (SPEC-02
 * §4.5, SPEC-07 §5/§7/§8). Todas exigen bearer (guard global de PR-02/T1) y
 * grupo (`409 NOT_ONBOARDED` si el usuario no tiene uno, alcance de T7,
 * punto 5).
 */
@ApiTags('Social')
@ApiBearerAuth()
@Controller()
export class SocialController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly challengesService: ChallengesService,
    private readonly weeklySummaryService: WeeklySummaryService,
  ) {}

  @Get('leaderboard')
  getLeaderboard(
    @CurrentUser('id') userId: string,
    @Query() query: WeekQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<LeaderboardResultDto> {
    return this.leaderboardService.getLeaderboard(userId, query.week, acceptLanguage);
  }

  @Get('challenges')
  getChallenges(
    @CurrentUser('id') userId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<ChallengesResultDto> {
    return this.challengesService.listChallenges(userId, acceptLanguage);
  }

  @Get('weekly-summary')
  getWeeklySummary(
    @CurrentUser('id') userId: string,
    @Query() query: WeekQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<WeeklySummaryResultDto> {
    return this.weeklySummaryService.getWeeklySummary(userId, query.week, acceptLanguage);
  }
}
