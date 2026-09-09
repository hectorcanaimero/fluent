import { IsIn } from 'class-validator';

/** Los dos motivos de cierre de SPEC-04 §5: temporizador de la app o el usuario. */
export const END_SESSION_REASONS = ['timer', 'user'] as const;
export type EndSessionReason = (typeof END_SESSION_REASONS)[number];

/**
 * Cuerpo de `POST /sessions/:id/end` (SPEC-04 §5). `reason` no se persiste
 * (`sessions` no tiene columna para ello y la spec no le da ningún uso más
 * allá del cierre en sí): se valida y no se usa más, ver
 * docs/specs/pendientes/PR-04.md.
 */
export class EndSessionDto {
  @IsIn(END_SESSION_REASONS, { message: 'reason debe ser timer o user.' })
  reason!: EndSessionReason;
}
