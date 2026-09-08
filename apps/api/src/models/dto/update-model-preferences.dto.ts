import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { Provider } from '../../db/schema.js';

/** Los dos proveedores de SPEC-01 §2.4/§2.5 (CHECK de las columnas `*_provider`). */
const PROVIDER_IDS: readonly Provider[] = ['openrouter', 'gemini'];

/** Longitud máxima aceptada para un id de modelo (holgada a propósito). */
const MAX_MODEL_ID_LENGTH = 200;

/**
 * Cuerpo de `PUT /me/models` (SPEC-02 §4.2): elige el modelo de chat y el de
 * brief, cada uno con su propio proveedor. `class-validator` solo comprueba
 * la forma (proveedor conocido, cadena no vacía); que exista credencial
 * activa del proveedor y que el modelo esté en su catálogo es una regla de
 * dominio que valida `ModelsService` (`400 MODEL_NOT_AVAILABLE`, no
 * `VALIDATION`, si falla).
 */
export class UpdateModelPreferencesDto {
  @IsIn(PROVIDER_IDS, { message: `chatProvider debe ser uno de: ${PROVIDER_IDS.join(', ')}` })
  chatProvider!: Provider;

  @IsString({ message: 'chatModel debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'chatModel es obligatorio' })
  @MaxLength(MAX_MODEL_ID_LENGTH, {
    message: `chatModel no puede superar los ${MAX_MODEL_ID_LENGTH} caracteres`,
  })
  chatModel!: string;

  @IsIn(PROVIDER_IDS, { message: `briefProvider debe ser uno de: ${PROVIDER_IDS.join(', ')}` })
  briefProvider!: Provider;

  @IsString({ message: 'briefModel debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'briefModel es obligatorio' })
  @MaxLength(MAX_MODEL_ID_LENGTH, {
    message: `briefModel no puede superar los ${MAX_MODEL_ID_LENGTH} caracteres`,
  })
  briefModel!: string;
}
