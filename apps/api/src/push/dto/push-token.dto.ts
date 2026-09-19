import { IsIn, IsString, Length } from 'class-validator';
import type { PushPlatform } from '../push.repository.js';

const PLATFORMS: readonly PushPlatform[] = ['android', 'ios'];

/** `POST /me/push-token`. */
export class RegisterPushTokenDto {
  @IsString()
  @Length(10, 4096)
  token!: string;

  @IsIn(PLATFORMS)
  platform!: PushPlatform;
}

/** `DELETE /me/push-token` (al cerrar sesión en el teléfono). */
export class UnregisterPushTokenDto {
  @IsString()
  @Length(10, 4096)
  token!: string;
}
