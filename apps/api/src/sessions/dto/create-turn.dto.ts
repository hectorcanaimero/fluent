import { IsString, Length } from 'class-validator';
import { USER_MESSAGE_CHARS } from '../../llm/config.js';

/** SPEC-02 §7: «cuerpo de turno: 1 a 1 000 caracteres». */
export const TURN_TEXT_MIN_LENGTH = 1;
/**
 * El máximo coincide con `USER_MESSAGE_CHARS` de `src/llm/config.ts` (SPEC-03
 * §3, el presupuesto de contexto del mensaje del aprendiz): se reutiliza esa
 * constante en vez de repetir el 1 000 para que los dos límites no puedan
 * separarse (regla «nunca literales» del diseño de PR-04).
 */
export const TURN_TEXT_MAX_LENGTH = USER_MESSAGE_CHARS;

/**
 * Cuerpo de `POST /sessions/:id/turns` (SPEC-02 §4.3 y §7, SPEC-04 §4).
 *
 * `whitelist: true` en el `ValidationPipe` global descarta cualquier otro
 * campo, así que la app no puede colar `role` ni `idx`: el índice del turno lo
 * decide siempre la API (SPEC-04 §4 paso 2).
 */
export class CreateTurnDto {
  @IsString({ message: 'text debe ser texto.' })
  @Length(TURN_TEXT_MIN_LENGTH, TURN_TEXT_MAX_LENGTH, {
    message: `text debe tener entre ${TURN_TEXT_MIN_LENGTH} y ${TURN_TEXT_MAX_LENGTH} caracteres.`,
  })
  text!: string;
}
