import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/push-token.dto.js';
import { PushService } from './push.service.js';

/** Registro del token de notificaciones del teléfono. */
@ApiTags('Me')
@ApiBearerAuth()
@Controller()
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('me/push-token')
  @HttpCode(204)
  async register(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.pushService.registerToken(userId, dto.token, dto.platform);
  }

  @Delete('me/push-token')
  @HttpCode(204)
  async unregister(
    @CurrentUser('id') userId: string,
    @Body() dto: UnregisterPushTokenDto,
  ): Promise<void> {
    await this.pushService.unregisterToken(userId, dto.token);
  }
}
