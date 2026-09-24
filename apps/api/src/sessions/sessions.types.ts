import type { CorrectionCategory, SessionKind, TurnRole } from '../db/schema.js';

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

/**
 * `summary` de `POST /sessions/:id/end` (SPEC-04 §5). Nombres exactos de
 * `apps/mobile/lib/core/api/models.dart::SessionSummary`.
 */
export interface SessionSummaryDto {
  readonly xpEarned: number;
  readonly streak: number;
  readonly isDoubleDay: boolean;
  readonly correctionsCount: number;
  readonly durationSec: number;
  readonly nextIsBoss: boolean;
  /** Ids de las insignias ganadas al cerrar esta sesión (ronda 4). */
  readonly newBadges: readonly string[];
}

/** Respuesta completa de `POST /sessions/:id/end` (`SessionEndResult` en la app). */
export interface SessionEndResultDto {
  readonly summary: SessionSummaryDto;
}

/**
 * Elemento de `GET /sessions` (SPEC-02 §4.3). `nextCursor: null` cuando no
 * hay más páginas (`SessionListResult.nextCursor` es `String?` en la app, que
 * acepta tanto la ausencia de la clave como `null`).
 */
export interface SessionListResultDto {
  readonly items: readonly SessionInfoDto[];
  readonly nextCursor: string | null;
}

/**
 * Turno tal y como lo ve la app en `GET /sessions/:id`
 * (`apps/mobile/lib/core/api/models.dart::TurnRecord`). `role` son los
 * valores del esquema (`'user'`/`'tutor'`, SPEC-01 §2.7): el desajuste con
 * `conversation_screen.dart` (que compara contra `'assistant'`) lo arregla
 * PR-06, no este PR — ver docs/specs/pendientes/PR-04.md.
 */
export interface TurnRecordDto {
  readonly idx: number;
  readonly role: TurnRole;
  readonly text: string;
}

/** Respuesta de `GET /sessions/:id` (`SessionDetailResult` en la app). */
export interface SessionDetailResultDto {
  readonly session: SessionInfoDto;
  readonly turns: readonly TurnRecordDto[];
  readonly corrections: readonly CorrectionDto[];
}

/** Elemento de `roleplays` en `GET /sessions/suggestions` (`RoleplayOption` en la app). */
export interface RoleplaySuggestionDto {
  readonly id: string;
  readonly title: string;
}

/** Elemento de `news` en `GET /sessions/suggestions` (`NewsItem` en la app). */
export interface NewsSuggestionDto {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly summary?: string;
  readonly time?: string;
}

/** Respuesta de `GET /sessions/suggestions` (SPEC-04 §7). */
export interface SessionSuggestionsDto {
  readonly topics: readonly string[];
  readonly roleplays: readonly RoleplaySuggestionDto[];
  readonly news: readonly NewsSuggestionDto[];
  readonly bossPending: boolean;
}
