import type { ApplyStreakGraceResult, UpdateGroupStreaksResult } from '../../db/rpc.js';
import { MaintenanceRepository } from './maintenance.repository.js';
import { RetentionService } from './retention.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-08T00:00:00.000Z');

interface FakeLlmCallRow {
  readonly id: string;
  readonly created_at: string;
}

interface FakeSessionRow {
  readonly id: string;
  readonly started_at: string;
}

interface FakeTurnRow {
  readonly id: string;
  readonly session_id: string;
}

/**
 * Repositorio doble que simula el filtrado real de Postgres: solo borra las
 * filas cuya fecha es anterior al `cutoffIso` que pasa `RetentionService`, y
 * las quita de su almacén en memoria (para poder comprobar que las filas
 * "nuevas" sobreviven a la ejecución).
 */
class FakeMaintenanceRepository extends MaintenanceRepository {
  llmCalls: FakeLlmCallRow[];
  sessions: FakeSessionRow[];
  turns: FakeTurnRow[];

  constructor(options: {
    llmCalls: FakeLlmCallRow[];
    sessions: FakeSessionRow[];
    turns: FakeTurnRow[];
  }) {
    super();
    this.llmCalls = options.llmCalls;
    this.sessions = options.sessions;
    this.turns = options.turns;
  }

  async applyStreakGrace(): Promise<ApplyStreakGraceResult> {
    throw new Error('no usado en este test');
  }

  async updateGroupStreaks(): Promise<UpdateGroupStreaksResult> {
    throw new Error('no usado en este test');
  }

  async deleteLlmCallsOlderThan(cutoffIso: string): Promise<number> {
    const toDelete = this.llmCalls.filter((row) => row.created_at < cutoffIso);
    this.llmCalls = this.llmCalls.filter((row) => row.created_at >= cutoffIso);
    return toDelete.length;
  }

  async deleteTurnsForSessionsStartedBefore(cutoffIso: string): Promise<number> {
    const oldSessionIds = new Set(
      this.sessions.filter((s) => s.started_at < cutoffIso).map((s) => s.id),
    );
    if (oldSessionIds.size === 0) return 0;
    const toDelete = this.turns.filter((t) => oldSessionIds.has(t.session_id));
    this.turns = this.turns.filter((t) => !oldSessionIds.has(t.session_id));
    return toDelete.length;
  }
}

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

describe('RetentionService', () => {
  it('borra solo llm_calls con más de 90 días y turns de sesiones con más de 365 días', async () => {
    const repository = new FakeMaintenanceRepository({
      llmCalls: [
        { id: 'old-1', created_at: daysAgoIso(100) },
        { id: 'new-1', created_at: daysAgoIso(30) },
      ],
      sessions: [
        { id: 'session-old', started_at: daysAgoIso(400) },
        { id: 'session-new', started_at: daysAgoIso(10) },
      ],
      turns: [
        { id: 'turn-old-1', session_id: 'session-old' },
        { id: 'turn-old-2', session_id: 'session-old' },
        { id: 'turn-new-1', session_id: 'session-new' },
      ],
    });
    const service = new RetentionService({ repository, now: () => NOW });

    const result = await service.run();

    expect(result).toEqual({ llmCallsDeleted: 1, turnsDeleted: 2 });
    expect(repository.llmCalls.map((r) => r.id)).toEqual(['new-1']);
    expect(repository.turns.map((r) => r.id)).toEqual(['turn-new-1']);
  });

  it('no borra nada si todas las filas son recientes', async () => {
    const repository = new FakeMaintenanceRepository({
      llmCalls: [{ id: 'new-1', created_at: daysAgoIso(1) }],
      sessions: [{ id: 'session-new', started_at: daysAgoIso(1) }],
      turns: [{ id: 'turn-new-1', session_id: 'session-new' }],
    });
    const service = new RetentionService({ repository, now: () => NOW });

    const result = await service.run();

    expect(result).toEqual({ llmCallsDeleted: 0, turnsDeleted: 0 });
  });
});
