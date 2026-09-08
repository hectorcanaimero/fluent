import { IsIn, IsString, Length } from 'class-validator';
import { IsInterestsCatalog } from '../../common/validators/interests-catalog.validator.js';
import { IsIanaTimezone } from '../../common/validators/iana-timezone.validator.js';
import type { Level, Locale } from '../../db/schema.js';

const LEVELS: readonly Level[] = ['A2', 'B1', 'B2'];
const LOCALES: readonly Locale[] = ['es', 'pt-BR'];

/**
 * `PUT /me/profile` (SPEC-02 §4.1, §8). Los cuatro campos son obligatorios:
 * la spec no describe una actualización parcial, y el cálculo de `onboarded`
 * (docs/specs/pendientes/PR-02.md) asume que, si la validación pasa, el
 * perfil queda completo.
 */
export class UpdateProfileDto {
  @IsString()
  @Length(2, 30)
  displayName!: string;

  @IsIn(LEVELS)
  level!: Level;

  @IsInterestsCatalog()
  interests!: string[];

  @IsIanaTimezone()
  timezone!: string;

  @IsIn(LOCALES)
  locale!: Locale;
}
