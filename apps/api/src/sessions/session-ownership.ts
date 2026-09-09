/**
 * Comprobación de propiedad de una sesión, compartida por todos los
 * endpoints que reciben un `:id` de sesión (`POST /sessions/:id/turns` de T2,
 * `POST /sessions/:id/end` y `GET /sessions/:id` de T3).
 *
 * **Aislamiento entre usuarios** (PEND-30/PEND-42 de docs/specs/pendientes/
 * PR-02.md y PR-04.md): `403 FORBIDDEN` sin distinguir "no existe" de "es de
 * otro usuario", para no filtrar qué sesiones existen. Un `:id` que ni
 * siquiera tiene forma de UUID se rechaza con el mismo `403` antes de tocar
 * la base, para que un `22P02` de Postgres no salga como `500`.
 *
 * Vive en su propio módulo (no dentro de `turns.service.ts`) para que T3 lo
 * reutilice sin duplicar la comprobación de UUID ni la consulta.
 */
import { ApiException } from '../common/api-error.js';
import type { Session } from '../db/schema.js';
import type { TurnsRepository } from './turns.repository.js';

/** Forma de un UUID v4 tal y como los genera Postgres (`gen_random_uuid()`). */
export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FORBIDDEN_SESSION_MESSAGE = 'Esa sesión no existe o no te pertenece.';

/**
 * Sesión de `userId` con id `sessionId`, sea cual sea su `status`. Lanza
 * `403 FORBIDDEN` si el id no tiene forma de UUID, si la sesión no existe o
 * si es de otro usuario.
 */
export async function findOwnedSessionOrThrow(
  repo: Pick<TurnsRepository, 'findOwnedSession'>,
  userId: string,
  sessionId: string,
): Promise<Session> {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw ApiException.forbidden(FORBIDDEN_SESSION_MESSAGE);
  }

  const session = await repo.findOwnedSession(userId, sessionId);
  if (session === null) {
    throw ApiException.forbidden(FORBIDDEN_SESSION_MESSAGE);
  }
  return session;
}
