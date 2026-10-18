import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { INTERVIEW_TYPES, type InterviewType } from '../interviews.types.js';

/** I2: «≤ 20000 caracteres». */
export const OFFER_TEXT_MAX_LENGTH = 20000;

/**
 * Cuerpo de `POST /interviews` (I2, F10.3.T2).
 *
 * Solo `type` es obligatorio a nivel de DTO: que venga exactamente uno de
 * `offerText`/`offerUrl` es una regla cruzada entre los dos campos, y eso lo
 * valida `InterviewsService` (mismo criterio que `CreateSessionDto` para los
 * campos que dependen de `kind`).
 */
export class CreateInterviewDto {
  @IsIn(INTERVIEW_TYPES, { message: 'type debe ser technical o mixed.' })
  type!: InterviewType;

  @IsOptional()
  @IsString({ message: 'offerText debe ser texto.' })
  @MaxLength(OFFER_TEXT_MAX_LENGTH, {
    message: `offerText no puede superar ${OFFER_TEXT_MAX_LENGTH} caracteres.`,
  })
  offerText?: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'offerUrl debe ser una URL http o https.' },
  )
  offerUrl?: string;
}
