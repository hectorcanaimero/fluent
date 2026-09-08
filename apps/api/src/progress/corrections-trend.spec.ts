import { aggregateCorrectionsTrend, type CorrectionTrendRow } from './corrections-trend.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function row(category: string, daysAgo: number): CorrectionTrendRow {
  return {
    category,
    created_at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('aggregateCorrectionsTrend', () => {
  it('returns an empty array for no rows', () => {
    expect(aggregateCorrectionsTrend([], NOW)).toEqual([]);
  });

  it('groups by category and counts count30d/count7d separately', () => {
    const rows = [
      row('articles', 1), // within 7d
      row('articles', 6), // within 7d
      row('articles', 10), // within 30d, not 7d
      row('word_order', 3), // within 7d
    ];

    const result = aggregateCorrectionsTrend(rows, NOW);

    expect(result).toEqual([
      { category: 'articles', count30d: 3, count7d: 2 },
      { category: 'word_order', count30d: 1, count7d: 1 },
    ]);
  });

  it('a row exactly at the 7-day boundary counts as within the window (>=)', () => {
    const rows = [row('articles', 7)];
    const result = aggregateCorrectionsTrend(rows, NOW);
    expect(result).toEqual([{ category: 'articles', count30d: 1, count7d: 1 }]);
  });

  it('a row just past the 7-day boundary does not count towards count7d', () => {
    const rows = [
      {
        category: 'articles',
        created_at: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000 - 1).toISOString(),
      },
    ];
    const result = aggregateCorrectionsTrend(rows, NOW);
    expect(result).toEqual([{ category: 'articles', count30d: 1, count7d: 0 }]);
  });

  it('sorts by count30d desc, ties broken alphabetically by category', () => {
    const rows = [row('word_order', 1), row('articles', 1), row('articles', 2)];
    const result = aggregateCorrectionsTrend(rows, NOW);
    expect(result.map((r) => r.category)).toEqual(['articles', 'word_order']);
  });
});
