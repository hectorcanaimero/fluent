import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { ListSessionsQueryDto } from './dto/list-sessions-query.dto.js';
import { findOwnedSessionOrThrow } from './session-ownership.js';
import { decodeSessionsCursor, encodeSessionsCursor } from './sessions-cursor.js';
import { SessionsHistoryRepository } from './sessions-history.repository.js';
import { toCorrectionDto, toSessionInfoDto } from './sessions.mapper.js';
import { SESSIONS_LIST_DEFAULT_LIMIT } from './sessions.constants.js';
import type { SessionDetailResultDto, SessionListResultDto } from './sessions.types.js';
import { TurnsRepository } from './turns.repository.js';

const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';

/** `GET /sessions` y `GET /sessions/:id` (SPEC-02 §4.3). */
@Injectable()
export class SessionsHistoryService {
  constructor(
    private readonly repository: SessionsHistoryRepository,
    private readonly turnsRepository: TurnsRepository,
  ) {}

  async list(userId: string, query: ListSessionsQueryDto): Promise<SessionListResultDto> {
    const limit = query.limit ?? SESSIONS_LIST_DEFAULT_LIMIT;
    const cursorStartedAt = query.cursor === undefined ? null : this.decodeCursor(query.cursor);

    const rows = await this.repository.listByUser(userId, limit, cursorStartedAt);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = page.at(-1);

    return {
      // `.map(toSessionInfoDto)` pasaría el índice como segundo argumento:
      // desde MAL-24 ese hueco es el de las opciones.
      items: page.map((row) => toSessionInfoDto(row)),
      nextCursor: hasMore && lastRow ? encodeSessionsCursor(lastRow) : null,
    };
  }

  async detail(userId: string, sessionId: string): Promise<SessionDetailResultDto> {
    const session = await findOwnedSessionOrThrow(this.turnsRepository, userId, sessionId);

    const [turns, corrections] = await Promise.all([
      this.repository.listTurns(session.id),
      this.repository.listCorrections(session.id),
    ]);

    return {
      session: toSessionInfoDto(session),
      turns: turns.map((turn) => ({ idx: turn.idx, role: turn.role, text: turn.text })),
      corrections: corrections.map(toCorrectionDto),
    };
  }

  /** `400 VALIDATION` (no `500`) si `cursor` está corrupto (SPEC-02 §6). */
  private decodeCursor(cursor: string): string {
    try {
      return decodeSessionsCursor(cursor).startedAt;
    } catch {
      throw ApiException.of('VALIDATION', VALIDATION_MESSAGE, {
        extra: { details: [{ field: 'cursor', reason: 'cursor no es válido.' }] },
      });
    }
  }
}
