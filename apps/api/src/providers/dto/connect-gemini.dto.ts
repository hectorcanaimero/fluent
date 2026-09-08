import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Longitud máxima aceptada para una API key de Gemini (holgada a propósito). */
const MAX_API_KEY_LENGTH = 500;

/**
 * Cuerpo de `POST /providers/gemini` (SPEC-02 §4.2). La key se valida contra
 * `/models` antes de guardarse; aquí solo se comprueba la forma.
 *
 * `apiKey` nunca se registra en el log ni se devuelve en la respuesta: el
 * endpoint contesta solo con el estado de la credencial.
 */
export class ConnectGeminiDto {
  @IsString({ message: 'apiKey debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'apiKey es obligatoria' })
  @MaxLength(MAX_API_KEY_LENGTH, {
    message: `apiKey no puede superar los ${MAX_API_KEY_LENGTH} caracteres`,
  })
  apiKey!: string;
}
