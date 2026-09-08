import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Longitud máxima aceptada para el `code` que devuelve OpenRouter. */
const MAX_CODE_LENGTH = 4096;

/**
 * Cuerpo de `POST /providers/openrouter/pkce/complete` (SPEC-02 §4.2):
 * el `code` que la app recibió en el deep link y el id opaco del
 * `code_verifier` que devolvió `start` (SPEC-06 §7).
 */
export class PkceCompleteDto {
  @IsString({ message: 'code debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'code es obligatorio' })
  @MaxLength(MAX_CODE_LENGTH, {
    message: `code no puede superar los ${MAX_CODE_LENGTH} caracteres`,
  })
  code!: string;

  @IsUUID('4', { message: 'codeVerifierId debe ser el identificador devuelto por /pkce/start' })
  codeVerifierId!: string;
}
