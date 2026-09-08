import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProfilesService } from './profiles.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { MeDto, ProfileDto } from './profiles.types.js';

/**
 * `GET /me`, `PUT /me/profile`, `DELETE /me` (SPEC-02 §4.1).
 *
 * Todas las rutas exigen bearer (guard global de PR-02/T1); ninguna se marca
 * `@Public()`.
 */
@Controller()
export class MeController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string): Promise<MeDto> {
    return this.profilesService.getMe(userId);
  }

  /** Devuelve el `profile` **plano** (no envuelto), como pide el contrato de la app. */
  @Put('me/profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.profilesService.updateProfile(userId, dto);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    await this.profilesService.deleteAccountData(userId);
  }
}
