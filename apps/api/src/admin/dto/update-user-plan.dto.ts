import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { Plan } from '../../db/schema.js';

/** `PUT /admin/users/:id/plan` (F2.3.T1). `expiresAt` ausente o `null` = sin vencimiento. */
export class UpdateUserPlanDto {
  @IsIn(['free', 'pro'])
  plan!: Plan;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
