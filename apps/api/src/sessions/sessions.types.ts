import type { CorrectionCategory, SessionKind } from '../db/schema.js';

/**
 * Sesión tal y como la ve la app. Nombres de campo exactamente los de
 * `apps/mobile/lib/core/api/models.dart::SessionInfo` (ese archivo no se
 * toca): `id`, `kind`, `topic?`, `startedAt`, `endedAt?`, `xpEarned?`,
 * `modelUsed?`.
 */
export interface SessionInfoDto {
  readonly id: string;
  readonly kind: SessionKind;
  readonly topic: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly xpEarned: number;
  readonly modelUsed: string | null;
}

/**
 * `opening` de `POST /sessions` (SPEC-02 §4.3, SPEC-04 §3.5).
 * `apps/mobile/.../SessionOpening` tiene `text` obligatorio y `callbackUsed`
 * con `@Default(false)`.
 */
export interface SessionOpeningDto {
  readonly text: string;
  readonly callbackUsed: boolean;
}

/** Respuesta completa de `POST /sessions`. */
export interface CreateSessionResultDto {
  readonly session: SessionInfoDto;
  readonly opening: SessionOpeningDto;
}

/**
 * Corrección tal y como la ve la app
 * (`apps/mobile/lib/core/api/models.dart::Correction`): los cuatro campos, con
 * `note` **no** nullable (un `note` nulo se mapea a `''`, ver
 * `toCorrectionDto`).
 */
export interface CorrectionDto {
  readonly original: string;
  readonly corrected: string;
  readonly category: CorrectionCategory;
  readonly note: string;
}

/**
 * Respuesta de `POST /sessions/:id/turns` (SPEC-04 §4 paso 7). Nombres exactos
 * de `apps/mobile/lib/core/api/models.dart::TurnResult`
 * (`turnIdx`, `reply`, `corrections`, `modelUsed?`, `degraded`), más
 * `unavailable` cuando la cadena de modelos se agotó (SPEC-03 §6); la app
 * ignora los campos que no conoce.
 *
 * `turnIdx` es el `idx` del turno **del usuario**, no el del tutor: es lo que
 * la app usa para colgar las correcciones bajo el mensaje del aprendiz
 * (RF-3.4) y lo que se guarda en `corrections.turn_idx`. Ver
 * docs/specs/pendientes/PR-04.md.
 */
export interface TurnResultDto {
  readonly turnIdx: number;
  readonly reply: string;
  readonly corrections: readonly CorrectionDto[];
  readonly modelUsed: string | null;
  readonly degraded: boolean;
  /** Solo presente (y `true`) en la respuesta degradada de SPEC-03 §6. */
  readonly unavailable?: boolean;
}
