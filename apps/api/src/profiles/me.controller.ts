import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProfilesService } from './profiles.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { MeDto, UpdateProfileResultDto } from './profiles.types.js';

/**
 * `GET /me`, `PUT /me/profile`, `DELETE /me` (SPEC-02 §4.1).
 *
 * Todas las rutas exigen bearer (guard global de PR-02/T1); ninguna se marca
 * `@Public()`.
 */
@ApiTags('Me')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string): Promise<MeDto> {
    return this.profilesService.getMe(userId);
  }

  /**
   * Devuelve el `profile` **plano** (no envuelto), como pide el contrato de
   * la app, más `xpAwarded` (MEJ-14) al mismo nivel.
   */
  @Put('me/profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdateProfileResultDto> {
    return this.profilesService.updateProfile(userId, dto);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    await this.profilesService.deleteAccountData(userId);
  }
}
