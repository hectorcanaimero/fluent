import { levelFor, type ProgressSummary } from '../game/progress.service.js';
import { toProgressResultDto } from './progress.mapper.js';

/**
 * El mapeo al contrato de la app (`models.dart::ProgressResult`). Los casos de
 * nivel son los que probaba `src/progress/level.spec.ts` antes de fusionar
 * PR-07: se comprueban ahora contra `levelFor` de `src/game/` + este mapper,
 * que es lo que acaba viajando en el JSON (PEND-71).
 */
function summary(overrides: Partial<ProgressSummary> = {}): ProgressSummary {
  return {
    xp: 0,
    level: levelFor(0),
    streak: 0,
    longestStreak: 0,
    sessionsThisWeek: 0,
    correctionsTrend: [],
    grace: 'available',
    ...overrides,
  };
}

describe('toProgressResultDto · level', () => {
  it.each([
    [0, 'Newcomer', 0, 500],
    [499, 'Newcomer', 0, 500],
    [500, 'Chatterbox', 500, 1500],
    [1499, 'Chatterbox', 500, 1500],
    [1500, 'Storyteller', 1500, 3500],
    [3499, 'Storyteller', 1500, 3500],
    [3500, 'Debater', 3500, 7000],
    [6999, 'Debater', 3500, 7000],
    [7000, 'Native-ish', 7000, null],
    [50_000, 'Native-ish', 7000, null],
  ])('xp=%i -> %s (min=%i, next=%p)', (xp, name, min, next) => {
    const dto = toProgressResultDto(summary({ xp, level: levelFor(xp) }));

    expect(dto.level).toEqual({ name, min, next });
    expect(dto.xp).toBe(xp);
  });

  it('un xp negativo cae al primer nivel sin romper el DTO', () => {
    const dto = toProgressResultDto(summary({ xp: -10, level: levelFor(-10) }));

    expect(dto.level).toEqual({ name: 'Newcomer', min: 0, next: 500 });
  });
});

describe('toProgressResultDto · correctionsTrend', () => {
  it('renombra last30/last7 a count30d/count7d', () => {
    const dto = toProgressResultDto(
      summary({ correctionsTrend: [{ category: 'articles', last7: 2, last30: 3 }] }),
    );

    expect(dto.correctionsTrend).toEqual([
      { category: 'articles', count30d: 3, count7d: 2 },
    ]);
  });

  it('ordena por count30d descendente y, en empate, alfabéticamente', () => {
    const dto = toProgressResultDto(
      summary({
        correctionsTrend: [
          { category: 'word_order', last7: 1, last30: 1 },
          { category: 'plurals', last7: 0, last30: 5 },
          { category: 'articles', last7: 1, last30: 1 },
        ],
      }),
    );

    expect(dto.correctionsTrend.map((entry) => entry.category)).toEqual([
      'plurals',
      'articles',
      'word_order',
    ]);
  });

  it('una tendencia vacía se mapea a un array vacío', () => {
    expect(toProgressResultDto(summary()).correctionsTrend).toEqual([]);
  });
});

describe('toProgressResultDto · resto de campos', () => {
  it('pasa xp, streak, longestStreak y sessionsThisWeek tal cual', () => {
    const dto = toProgressResultDto(
      summary({ xp: 1600, level: levelFor(1600), streak: 4, longestStreak: 10, sessionsThisWeek: 2 }),
    );

    expect(dto).toEqual({
      xp: 1600,
      level: { name: 'Storyteller', min: 1500, next: 3500 },
      streak: 4,
      longestStreak: 10,
      sessionsThisWeek: 2,
      correctionsTrend: [],
    });
  });

  it('no expone `grace`: no está en SPEC-02 §4.5 ni en el modelo de la app', () => {
    const dto = toProgressResultDto(summary({ grace: 'used' }));

    expect(dto).not.toHaveProperty('grace');
  });
});
