import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const CREATE_INVITATIONS_DEFAULT_COUNT = 1;
export const CREATE_INVITATIONS_MIN_COUNT = 1;
export const CREATE_INVITATIONS_MAX_COUNT = 10;

/**
 * `POST /admin/invitations` (SPEC-02 §4.1). `count` es opcional, entero,
 * de 1 a 10, con valor por defecto 1 (aplicado por `GroupsService`, no aquí,
 * para que `undefined` siga distinguiéndose de «se pidió 1» en el DTO).
 */
export class CreateInvitationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(CREATE_INVITATIONS_MIN_COUNT)
  @Max(CREATE_INVITATIONS_MAX_COUNT)
  count?: number;
}
