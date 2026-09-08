import { IsNotEmpty, IsString } from 'class-validator';

/** `POST /invitations/redeem` (SPEC-02 §4.1). */
export class RedeemInvitationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
