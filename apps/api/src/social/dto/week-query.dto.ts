import { IsOptional, Matches } from 'class-validator';

/**
 * Formato de `?week=` (SPEC-02 §4.5): fecha ISO `YYYY-MM-DD`, sin hora. Debe
 * coincidir exactamente con `WEEK_PARAM_PATTERN` de `common/iso-week.ts`.
 */
const WEEK_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query de `GET /leaderboard` y `GET /weekly-summary` (SPEC-02 §4.5): `week`
 * es opcional. `class-validator` solo comprueba el formato superficial
 * (`YYYY-MM-DD`); que sea una fecha real (no `2024-02-30`) lo valida
 * `resolveWeekStart` (`common/iso-week.ts`), que devuelve `null` para que el
 * servicio lo traduzca a `400 VALIDATION` con el mismo código que este DTO.
 */
export class WeekQueryDto {
  @IsOptional()
  @Matches(WEEK_PARAM_PATTERN, { message: 'week debe tener el formato YYYY-MM-DD' })
  week?: string;
}
