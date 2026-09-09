import type { SessionKind } from '../db/schema.js';

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
