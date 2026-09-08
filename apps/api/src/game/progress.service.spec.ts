import { isoDateString, mondayUtcOf } from './iso-week.js';
import {
  ProgressService,
  levelFor,
  type ProgressCorrectionRow,
  type ProgressProfileRow,
  type ProgressRepository,
} from './progress.service.js';

/**
 * Repositorio simulado en memoria, siguiendo el patrón de `memorySink()` /
 * `scriptedClient()` en apps/api/src/llm/llm.service.spec.ts: datos programables
 * más un registro de con qué argumentos se llamó cada método, para poder
 * verificar el `sinceIso` exacto que calcula `ProgressService`.
 */
function fakeRepo(options: {
  profile: ProgressProfileRow;
  sessionsThisWeek?: number;
  corrections?: ProgressCorrectionRow[];
}): ProgressRepository & {
  calls: {
    countValidSessionsSince: Array<{ userId: string; sinceIso: string }>;
    getCorrectionsSince: Array<{ userId: string; sinceIso: string }>;
  };
} {
  const calls = {
    countValidSessionsSince: [] as Array<{ userId: string; sinceIso: string }>,
    getCorrectionsSince: [] as Array<{ userId: string; sinceIso: string }>,
  };

  return {
    calls,
    getProfile: async () => options.profile,
    countValidSessionsSince: async (userId, sinceIso) => {
      calls.countValidSessionsSince.push({ userId, sinceIso });
      return options.sessionsThisWeek ?? 0;
    },
    getCorrectionsSince: async (userId, sinceIso) => {
      calls.getCorrectionsSince.push({ userId, sinceIso });
      // Simula que el repositorio real ya filtra por `created_at >= sinceIso`.
      const since = new Date(sinceIso).getTime();
      return (options.corrections ?? []).filter(
        (c) => new Date(c.createdAt).getTime() >= since,
      );
    },
  };
}

function profile(overrides: Partial<ProgressProfileRow> = {}): ProgressProfileRow {
  return {
    xp: 0,
    timezone: 'America/Sao_Paulo',
    graceUsedWeek: null,
    ...overrides,
  };
}

describe('levelFor', () => {
  it.each([
    [0, 'Newcomer', 'Chatterbox', 500],
    [499, 'Newcomer', 'Chatterbox', 1],
    [500, 'Chatterbox', 'Storyteller', 1000],
    [1499, 'Chatterbox', 'Storyteller', 1],
    [1500, 'Storyteller', 'Debater', 2000],
    [3499, 'Storyteller', 'Debater', 1],
    [3500, 'Debater', 'Native-ish', 3500],
    [6999, 'Debater', 'Native-ish', 1],
    [7000, 'Native-ish', null, null],
    [50000, 'Native-ish', null, null],
  ])('xp=%i -> current=%s next=%s xpToNext=%s', (xp, currentName, nextName, xpToNext) => {
    const result = levelFor(xp as number);
    expect(result.current.name).toBe(currentName);
    expect(result.next?.name ?? null).toBe(nextName);
    expect(result.xpToNext).toBe(xpToNext);
  });

  it('trata un xp negativo como el nivel más bajo (Newcomer)', () => {
    const result = levelFor(-10);
    expect(result.current.name).toBe('Newcomer');
    expect(result.next?.name).toBe('Chatterbox');
  });
});

describe('ProgressService.getProgress', () => {
  const now = new Date('2026-09-09T12:00:00.000Z'); // miércoles
  const weekStart = mondayUtcOf(now); // 2026-09-07T00:00:00.000Z

  it('pide sessionsThisWeek desde el lunes 00:00 UTC de la semana de `now`', async () => {
    const repo = fakeRepo({ profile: profile({ xp: 600 }), sessionsThisWeek: 4 });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    expect(result.sessionsThisWeek).toBe(4);
    expect(repo.calls.countValidSessionsSince).toEqual([
      { userId: 'user-1', sinceIso: weekStart.toISOString() },
    ]);
  });

  it('level refleja el xp del perfil devuelto por el repositorio', async () => {
    const repo = fakeRepo({ profile: profile({ xp: 1500 }) });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    expect(result.level.current.name).toBe('Storyteller');
    expect(result.level.next?.name).toBe('Debater');
  });

  it('pide las correcciones desde 30 días antes de `now`', async () => {
    const repo = fakeRepo({ profile: profile() });
    const service = new ProgressService(repo);

    await service.getProgress('user-1', now);

    const expectedSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(repo.calls.getCorrectionsSince).toEqual([
      { userId: 'user-1', sinceIso: expectedSince },
    ]);
  });

  it('correctionsTrend agrupa por categoría y separa last7 de last30', async () => {
    const corrections: ProgressCorrectionRow[] = [
      // dentro de los últimos 7 días (>= 2026-09-02T12:00:00Z)
      { category: 'articles', createdAt: '2026-09-08T10:00:00.000Z' },
      { category: 'past_simple', createdAt: '2026-09-09T11:00:00.000Z' },
      // dentro de los últimos 30 pero fuera de los últimos 7
      { category: 'articles', createdAt: '2026-08-20T10:00:00.000Z' },
      { category: 'past_simple', createdAt: '2026-08-15T00:00:00.000Z' },
      { category: 'past_simple', createdAt: '2026-08-12T00:00:00.000Z' },
      // fuera de los últimos 30 días: el repo fake ya lo filtra, nunca llega aquí
      { category: 'plurals', createdAt: '2026-07-01T00:00:00.000Z' },
    ];
    const repo = fakeRepo({ profile: profile(), corrections });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    const byCategory = Object.fromEntries(
      result.correctionsTrend.map((entry) => [entry.category, entry]),
    );

    expect(byCategory.articles).toEqual({ category: 'articles', last7: 1, last30: 2 });
    expect(byCategory.past_simple).toEqual({ category: 'past_simple', last7: 1, last30: 3 });
    // 'plurals' quedó fuera del rango de 30 días -> no aparece en la tendencia.
    expect(byCategory.plurals).toBeUndefined();
  });

  it('grace = "available" cuando graceUsedWeek no coincide con el lunes de `now`', async () => {
    const repo = fakeRepo({ profile: profile({ graceUsedWeek: null }) });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    expect(result.grace).toBe('available');
  });

  it('grace = "available" cuando graceUsedWeek es de una semana anterior', async () => {
    const repo = fakeRepo({ profile: profile({ graceUsedWeek: '2026-08-31' }) });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    expect(result.grace).toBe('available');
  });

  it('grace = "used" cuando graceUsedWeek es el lunes UTC de la semana de `now`', async () => {
    const repo = fakeRepo({ profile: profile({ graceUsedWeek: isoDateString(weekStart) }) });
    const service = new ProgressService(repo);

    const result = await service.getProgress('user-1', now);

    expect(result.grace).toBe('used');
  });
});
