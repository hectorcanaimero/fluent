import { IsString, Length } from 'class-validator';

/**
 * Máximo de `coaching_briefs.text` (SPEC-01 §2.10, alcance de T6). Coincide
 * con el CHECK `char_length(text) BETWEEN 1 AND 600` de la migración: el
 * mínimo de 1 también viene de ahí (un brief vacío no es una fila válida),
 * así que no se acepta `text: ''`.
 */
export const BRIEF_TEXT_MAX_LENGTH = 600;
const BRIEF_TEXT_MIN_LENGTH = 1;

/** `PUT /memory/brief` (SPEC-02 §4.4): `400 VALIDATION` si supera los 600 caracteres. */
export class PutBriefDto {
  @IsString()
  @Length(BRIEF_TEXT_MIN_LENGTH, BRIEF_TEXT_MAX_LENGTH)
  text!: string;
}
