import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { GroupDto, GroupMemberDto } from '../profiles/profiles.types.js';
import { CreateInvitationsDto } from './dto/create-invitations.dto.js';
import { RedeemInvitationDto } from './dto/redeem-invitation.dto.js';
import { DEFAULT_INVITATIONS_COUNT, GroupsService } from './groups.service.js';

/**
 * `POST /invitations/redeem`, `POST /admin/invitations`, `GET /group`
 * (SPEC-02 §4.1). Todas exigen bearer (guard global de PR-02/T1).
 */
@Controller()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('invitations/redeem')
  redeemInvitation(
    @CurrentUser('id') userId: string,
    @Body() dto: RedeemInvitationDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<{ group: GroupDto }> {
    return this.groupsService.redeemInvitation(userId, dto.code, acceptLanguage);
  }

  @Post('admin/invitations')
  createInvitations(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvitationsDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<{ codes: string[] }> {
    return this.groupsService.createInvitations(
      userId,
      dto.count ?? DEFAULT_INVITATIONS_COUNT,
      acceptLanguage,
    );
  }

  @Get('group')
  getGroup(
    @CurrentUser('id') userId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<{ group: GroupDto; members: GroupMemberDto[] }> {
    return this.groupsService.getGroup(userId, acceptLanguage);
  }
}
