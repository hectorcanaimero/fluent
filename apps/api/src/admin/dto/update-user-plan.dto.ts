import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { Plan } from '../../db/schema.js';

const PLANS: readonly Plan[] = ['free', 'pro'];

/** `PUT /admin/users/:id/plan` (F2.3). `expiresAt` ausente o `null` = sin vencimiento. */
export class UpdateUserPlanDto {
  @IsIn(PLANS)
  plan!: Plan;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
