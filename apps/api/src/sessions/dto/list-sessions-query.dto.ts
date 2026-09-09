import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SESSIONS_LIST_MAX_LIMIT } from '../sessions.constants.js';

/**
 * Query de `GET /sessions` (SPEC-02 §4.3): `limit` por defecto 20, máximo 50
 * (aplicado por `SessionsHistoryService`, no aquí, para que `undefined` siga
 * distinguiéndose de «se pidió el mínimo» — mismo criterio que
 * `CreateInvitationsDto`). `cursor` solo se comprueba aquí como texto no
 * vacío: que tenga el formato de keyset válido lo decide
 * `decodeSessionsCursor` (`sessions-cursor.ts`), que devuelve `400
 * VALIDATION` sin tumbar la petición con un 500 si está corrupto.
 */
export class ListSessionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero.' })
  @Min(1, { message: 'limit debe ser al menos 1.' })
  @Max(SESSIONS_LIST_MAX_LIMIT, { message: `limit no puede superar ${SESSIONS_LIST_MAX_LIMIT}.` })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'cursor debe ser texto.' })
  cursor?: string;
}
