import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_CALLBACK_URL_LENGTH } from '../pkce.js';

/**
 * Cuerpo de `POST /providers/openrouter/pkce/start` (SPEC-02 §4.2).
 *
 * `callbackUrl` es opcional: si la app no lo manda se usa
 * `OPENROUTER_OAUTH_CALLBACK` (SPEC-08 §2), que en producción vale
 * `fluent://oauth/openrouter` — el mismo deep link que abre la app
 * (SPEC-06 §7). La forma concreta (URL absoluta con esquema, sin esquemas
 * peligrosos) la valida `isValidCallbackUrl` en el servicio, porque es una
 * regla de dominio y no un simple formato.
 */
export class PkceStartDto {
  @IsOptional()
  @IsString({ message: 'callbackUrl debe ser una cadena de texto' })
  @MaxLength(MAX_CALLBACK_URL_LENGTH, {
    message: `callbackUrl no puede superar los ${MAX_CALLBACK_URL_LENGTH} caracteres`,
  })
  callbackUrl?: string;
}
