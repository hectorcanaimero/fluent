import {
  LeaderboardService,
  type LeaderboardRepository,
  type WeeklyLeaderboardSummary,
} from './leaderboard.service.js';
import type { WeeklyLeaderboardEntry } from '../db/rpc.js';

/**
 * Repositorio simulado en memoria, siguiendo el patrón de `fakeRepo()` en
 * progress.service.spec.ts: datos programables más un registro de con qué
 * argumentos se llamó cada método.
 */
function fakeRepo(
  options?: {
    entries?: WeeklyLeaderboardEntry[];
    groupStreak?: number;
  },
): LeaderboardRepository & {
  calls: {
    weeklyLeaderboard: Array<{ groupId: string; weekStart: string }>;
    getGroupStreak: Array<{ groupId: string }>;
  };
} {
  const calls = {
    weeklyLeaderboard: [] as Array<{ groupId: string; weekStart: string }>,
    getGroupStreak: [] as Array<{ groupId: string }>,
  };

  return {
    calls,
    weeklyLeaderboard: async (groupId, weekStart) => {
      calls.weeklyLeaderboard.push({ groupId, weekStart });
      return options?.entries ?? [];
    },
    getGroupStreak: async (groupId) => {
      calls.getGroupStreak.push({ groupId });
      return options?.groupStreak ?? 0;
    },
  };
}

function entry(overrides: Partial<WeeklyLeaderboardEntry> = {}): WeeklyLeaderboardEntry {
  return {
    user_id: 'user-1',
    display_name: 'Alice',
    xp: 150,
    sessions: 2,
    rank: 1,
    ...overrides,
  };
}

describe('LeaderboardService.week', () => {
  describe('weekStart: cálculo de lunes UTC de la semana ISO', () => {
    it('miércoles (2026-09-09) → lunes de esa semana (2026-09-07)', async () => {
      const now = new Date('2026-09-09T12:00:00.000Z'); // miércoles
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.weekStart).toBe('2026-09-07');
      expect(repo.calls.weeklyLeaderboard).toEqual([
        { groupId: 'group-1', weekStart: '2026-09-07' },
      ]);
    });

    it('domingo (2026-09-06) → lunes de la semana anterior (2026-08-31)', async () => {
      const now = new Date('2026-09-06T18:30:00.000Z'); // domingo
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.weekStart).toBe('2026-08-31');
    });

    it('lunes 00:00:00.000 UTC (2026-09-07T00:00:00Z) → el mismo lunes (2026-09-07)', async () => {
      const now = new Date('2026-09-07T00:00:00.000Z'); // lunes exacto a medianoche UTC
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.weekStart).toBe('2026-09-07');
    });

    it('cambio de año: 2027-01-01 (viernes) → lunes de la semana ISO anterior (2026-12-28)', async () => {
      const now = new Date('2027-01-01T10:00:00.000Z'); // viernes
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      // La semana ISO que contiene 2027-01-01 (viernes) empezó el 2026-12-28 (lunes).
      expect(result.weekStart).toBe('2026-12-28');
    });
  });

  describe('daysRemaining: cálculo de días hasta el próximo reinicio', () => {
    it('miércoles (2026-09-09, 12:00 UTC) → 5 días restantes', async () => {
      // Miércoles es día 3 de la semana (lunes=0, ..., domingo=6).
      // Faltan: jueves, viernes, sábado, domingo, y el próximo lunes.
      // Próximo lunes: 2026-09-14 00:00 UTC
      // Diferencia: (2026-09-14 00:00 - 2026-09-09 12:00) ≈ 4.5 días = ceil(4.5) = 5
      const now = new Date('2026-09-09T12:00:00.000Z');
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.daysRemaining).toBe(5);
    });

    it('domingo (2026-09-06, 23:59:59 UTC) → 1 día restante', async () => {
      // Domingo es el último día de la semana ISO; faltan solo horas hasta el lunes.
      // Próximo lunes: 2026-09-07 00:00 UTC
      // Diferencia: (2026-09-07 00:00 - 2026-09-06 23:59:59) ≈ 0.00001 días = ceil(0.00001) = 1
      const now = new Date('2026-09-06T23:59:59.000Z');
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.daysRemaining).toBe(1);
    });

    it('lunes 00:00:00.000 UTC (2026-09-07T00:00:00Z) → 7 días restantes', async () => {
      // Es el primer momento de la semana; faltan exactamente 7 días hasta el próximo reinicio.
      // Próximo lunes: 2026-09-14 00:00 UTC
      // Diferencia: (2026-09-14 00:00 - 2026-09-07 00:00) = 7 días = ceil(7) = 7
      const now = new Date('2026-09-07T00:00:00.000Z');
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.daysRemaining).toBe(7);
    });

    it('lunes 00:00:00.001 UTC → 7 días restantes (apenas pasó el reinicio)', async () => {
      // Un milisegundo después del reinicio de lunes, quedan casi 7 días exactos.
      // Próximo lunes: 2026-09-14 00:00 UTC
      // Diferencia en ms: (2026-09-14 00:00) - (2026-09-07 00:00:00.001) = 604799999 ms
      // Diferencia en días: 604799999 / 86400000 ≈ 6.999999
      // daysRemaining = ceil(6.999999) = 7 (porque Math.ceil redondea hacia arriba)
      const now = new Date('2026-09-07T00:00:00.001Z');
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.daysRemaining).toBe(7);
    });

    it('cambio de año: 2026-12-30 (miércoles, fin de año) → 5 días', async () => {
      // 2026-12-28 es lunes de esa semana
      // Próximo lunes: 2027-01-04 00:00 UTC
      // now: 2026-12-30 12:00 UTC (miércoles)
      // Diferencia: (2027-01-04 00:00 - 2026-12-30 12:00) = 4.5 días = ceil(4.5) = 5
      // Desglose: 12:00 en Dec 30 + 12 horas = medianoche, luego 4 días completos (31, 1, 2, 3)
      // + 0 horas en Jan 4 = 4.5 días totales
      const now = new Date('2026-12-30T12:00:00.000Z');
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1', now);

      expect(result.daysRemaining).toBe(5);
    });
  });

  describe('entries: se devuelven tal cual del repositorio sin reordenamiento', () => {
    it('lista vacía se devuelve vacía', async () => {
      const repo = fakeRepo({ entries: [] });
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1');

      expect(result.entries).toEqual([]);
    });

    it('múltiples entradas se devuelven en el orden del repositorio (la RPC las ordena)', async () => {
      const entries: WeeklyLeaderboardEntry[] = [
        {
          user_id: 'user-1',
          display_name: 'Alice',
          xp: 200,
          sessions: 3,
          rank: 1,
        },
        {
          user_id: 'user-2',
          display_name: 'Bob',
          xp: 150,
          sessions: 2,
          rank: 2,
        },
        {
          user_id: 'user-3',
          display_name: 'Charlie',
          xp: 150,
          sessions: 1,
          rank: 3,
        },
      ];
      const repo = fakeRepo({ entries });
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1');

      expect(result.entries).toEqual(entries);
      expect(result.entries).toBe(entries); // misma referencia (no se crea array nuevo)
    });

    it('orden arbitrario se preserva (sin reordenar por rango o xp)', async () => {
      // Este test verifica que incluso si el repositorio devuelve entradas
      // "desordenadas" (por ejemplo, rank 3 antes que rank 2), el servicio
      // no las reordena.
      const entries: WeeklyLeaderboardEntry[] = [
        {
          user_id: 'user-3',
          display_name: 'Charlie',
          xp: 100,
          sessions: 1,
          rank: 3,
        },
        {
          user_id: 'user-1',
          display_name: 'Alice',
          xp: 300,
          sessions: 4,
          rank: 1,
        },
        {
          user_id: 'user-2',
          display_name: 'Bob',
          xp: 200,
          sessions: 2,
          rank: 2,
        },
      ];
      const repo = fakeRepo({ entries });
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1');

      // Orden preservado exacto: 3, 1, 2 (no reordenado a 1, 2, 3).
      expect(result.entries[0]?.rank).toBe(3);
      expect(result.entries[1]?.rank).toBe(1);
      expect(result.entries[2]?.rank).toBe(2);
    });
  });

  describe('groupStreak: se devuelve tal cual del repositorio', () => {
    it('streak 0 se devuelve como 0', async () => {
      const repo = fakeRepo({ groupStreak: 0 });
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1');

      expect(result.groupStreak).toBe(0);
    });

    it('streak positivo se devuelve igual', async () => {
      const repo = fakeRepo({ groupStreak: 7 });
      const service = new LeaderboardService(repo);

      const result = await service.week('group-1');

      expect(result.groupStreak).toBe(7);
    });
  });

  describe('repositorio: se llama con los argumentos correctos', () => {
    it('weeklyLeaderboard se llama con groupId y weekStart (YYYY-MM-DD)', async () => {
      const now = new Date('2026-09-09T12:00:00.000Z'); // miércoles
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      await service.week('my-group', now);

      expect(repo.calls.weeklyLeaderboard).toHaveLength(1);
      expect(repo.calls.weeklyLeaderboard[0]).toEqual({
        groupId: 'my-group',
        weekStart: '2026-09-07',
      });
    });

    it('getGroupStreak se llama con groupId', async () => {
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      await service.week('my-group');

      expect(repo.calls.getGroupStreak).toHaveLength(1);
      expect(repo.calls.getGroupStreak[0]).toEqual({ groupId: 'my-group' });
    });

    it('ambos métodos se llaman en paralelo (Promise.all)', async () => {
      let weeklyLeaderboardCalled = false;
      let getGroupStreakCalled = false;

      const repo = {
        calls: {
          weeklyLeaderboard: [],
          getGroupStreak: [],
        },
        weeklyLeaderboard: async (groupId: string, weekStart: string) => {
          repo.calls.weeklyLeaderboard.push({ groupId, weekStart });
          weeklyLeaderboardCalled = true;
          return [];
        },
        getGroupStreak: async (groupId: string) => {
          repo.calls.getGroupStreak.push({ groupId });
          getGroupStreakCalled = true;
          return 0;
        },
      };

      const service = new LeaderboardService(repo);
      await service.week('group-1');

      // Ambos deberían haberse llamado (aunque de forma paralela no se puede
      // probar orden exacto en este test simple, la llamada a Promise.all
      // los ejecuta en paralelo).
      expect(weeklyLeaderboardCalled).toBe(true);
      expect(getGroupStreakCalled).toBe(true);
    });
  });

  describe('por defecto: ahora es el momento actual', () => {
    it('si no se pasa `now`, calcula weekStart basado en el momento de la llamada', async () => {
      const repo = fakeRepo();
      const service = new LeaderboardService(repo);

      // Este test no puede verificar el valor exacto de weekStart porque depende
      // de cuándo se ejecute el test. En su lugar, verifica que se llamó al repositorio
      // con algún weekStart válido (YYYY-MM-DD format).
      await service.week('group-1');

      expect(repo.calls.weeklyLeaderboard).toHaveLength(1);
      const weekStart = repo.calls.weeklyLeaderboard[0]?.weekStart;
      expect(weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('resultado final: WeeklyLeaderboardSummary', () => {
    it('contiene todos los campos requeridos con valores correctos', async () => {
      const entries: WeeklyLeaderboardEntry[] = [entry({ user_id: 'user-1', rank: 1 })];
      const repo = fakeRepo({ entries, groupStreak: 5 });
      const service = new LeaderboardService(repo);
      const now = new Date('2026-09-09T12:00:00.000Z');

      const result: WeeklyLeaderboardSummary = await service.week('group-1', now);

      expect(result).toHaveProperty('weekStart', '2026-09-07');
      expect(result).toHaveProperty('daysRemaining', 5);
      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('groupStreak', 5);
      expect(result.weekStart).toBe('2026-09-07');
      expect(result.daysRemaining).toBe(5);
      expect(result.entries).toHaveLength(1);
      expect(result.groupStreak).toBe(5);
    });
  });
});
