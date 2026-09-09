import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import type { SessionKind } from '../../db/schema.js';

/** Los cuatro `kind` de SPEC-01 §2.6 / SPEC-04 §3.2. */
export const SESSION_KINDS: readonly SessionKind[] = [
  'free_topic',
  'roleplay',
  'news',
  'boss',
];

/** Longitud de `topic` para `free_topic` (SPEC-04 §3.2: «2 a 80 caracteres»). */
export const TOPIC_MIN_LENGTH = 2;
export const TOPIC_MAX_LENGTH = 80;

/**
 * Cuerpo de `POST /sessions` (SPEC-02 §4.3, SPEC-04 §3).
 *
 * Solo `kind` es obligatorio a nivel de DTO: qué campo adicional hace falta
 * depende del `kind` (SPEC-04 §3.2) y eso lo valida `SessionsService`, que es
 * quien además puede comprobar que el `roleplayId` existe en el catálogo o que
 * la noticia está dentro de la ventana de 14 días. `class-validator` no
 * expresa esa dependencia sin un decorador a medida, y hacer un decorador solo
 * para esto no compensa (mismo criterio que `PatchFactDto`, PEND-41 de
 * docs/specs/pendientes/PR-02.md).
 *
 * `challengeFromUserId` viene de SPEC-07 §7 («al aceptar, la app abre
 * `POST /sessions` con `kind` y `topic` iguales y `challengeFromUserId`»); la
 * app fusionada todavía no lo manda — ver docs/specs/pendientes/PR-04.md.
 */
export class CreateSessionDto {
  @IsIn(SESSION_KINDS, { message: 'kind debe ser free_topic, roleplay, news o boss.' })
  kind!: SessionKind;

  @IsOptional()
  @IsString({ message: 'topic debe ser texto.' })
  @Length(TOPIC_MIN_LENGTH, TOPIC_MAX_LENGTH, {
    message: `topic debe tener entre ${TOPIC_MIN_LENGTH} y ${TOPIC_MAX_LENGTH} caracteres.`,
  })
  topic?: string;

  @IsOptional()
  @IsString({ message: 'roleplayId debe ser texto.' })
  roleplayId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'newsItemId debe ser un UUID.' })
  newsItemId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'challengeFromUserId debe ser un UUID.' })
  challengeFromUserId?: string;
}
