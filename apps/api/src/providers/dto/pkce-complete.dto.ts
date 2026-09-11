import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Longitud máxima aceptada para el `code` que devuelve OpenRouter. */
const MAX_CODE_LENGTH = 4096;

/**
 * Cuerpo de `POST /providers/openrouter/pkce/complete` (SPEC-02 §4.2): basta
 * con el id opaco del `code_verifier` que devolvió `start` (SPEC-06 §7).
 *
 * `code` es **opcional** desde MAL-18: el callback público del navegador ya
 * deja el código guardado junto al verifier, así que la app solo manda
 * `{ codeVerifierId }`. Se sigue aceptando en el cuerpo por compatibilidad con
 * el flujo antiguo (código por deep link), pero el guardado tiene prioridad.
 */
export class PkceCompleteDto {
  @IsOptional()
  @IsString({ message: 'code debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'code no puede ser una cadena vacía' })
  @MaxLength(MAX_CODE_LENGTH, {
    message: `code no puede superar los ${MAX_CODE_LENGTH} caracteres`,
  })
  code?: string;

  @IsUUID('4', { message: 'codeVerifierId debe ser el identificador devuelto por /pkce/start' })
  codeVerifierId!: string;
}
