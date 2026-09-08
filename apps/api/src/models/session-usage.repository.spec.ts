import { aggregateTokensBySession, type LlmCallTokensRow } from './session-usage.repository.js';

function row(overrides: Partial<LlmCallTokensRow>): LlmCallTokensRow {
  return { session_id: 'session-1', tokens_in: 100, tokens_out: 50, ...overrides };
}

describe('aggregateTokensBySession (SPEC-03 §7, SPEC-01 §2.14)', () => {
  it('returns null when there are no rows', () => {
    expect(aggregateTokensBySession([])).toBeNull();
  });

  it('returns null when every row has session_id: null', () => {
    const rows = [row({ session_id: null }), row({ session_id: null })];
    expect(aggregateTokensBySession(rows)).toBeNull();
  });

  it('sums tokens within a session before averaging across sessions (not per-row)', () => {
    // Una sola sesión con 3 llamadas (turnos): la suma de la sesión es
    // 100+200+300=600 tokens_in, 10+20+30=60 tokens_out. Con una sola
    // sesión, el promedio es exactamente esa suma (no la media de las 3
    // filas, que daría 200/20).
    const rows: LlmCallTokensRow[] = [
      { session_id: 's1', tokens_in: 100, tokens_out: 10 },
      { session_id: 's1', tokens_in: 200, tokens_out: 20 },
      { session_id: 's1', tokens_in: 300, tokens_out: 30 },
    ];

    expect(aggregateTokensBySession(rows)).toEqual({ avgTokensIn: 600, avgTokensOut: 60 });
  });

  it('averages the per-session totals across several sessions', () => {
    const rows: LlmCallTokensRow[] = [
      { session_id: 's1', tokens_in: 1000, tokens_out: 200 },
      { session_id: 's1', tokens_in: 1000, tokens_out: 200 }, // s1 total: 2000 / 400
      { session_id: 's2', tokens_in: 500, tokens_out: 100 }, // s2 total: 500 / 100
    ];

    // Promedio de sesiones: (2000+500)/2 = 1250, (400+100)/2 = 250.
    expect(aggregateTokensBySession(rows)).toEqual({ avgTokensIn: 1250, avgTokensOut: 250 });
  });

  it('ignores rows with session_id: null but keeps the rest', () => {
    const rows: LlmCallTokensRow[] = [
      { session_id: null, tokens_in: 99_999, tokens_out: 99_999 }, // p. ej. purpose='weekly'
      { session_id: 's1', tokens_in: 100, tokens_out: 50 },
    ];

    expect(aggregateTokensBySession(rows)).toEqual({ avgTokensIn: 100, avgTokensOut: 50 });
  });

  it('treats null tokens_in/tokens_out as 0', () => {
    const rows: LlmCallTokensRow[] = [
      { session_id: 's1', tokens_in: null, tokens_out: null },
      { session_id: 's1', tokens_in: 100, tokens_out: 50 },
    ];

    expect(aggregateTokensBySession(rows)).toEqual({ avgTokensIn: 100, avgTokensOut: 50 });
  });

  it('a session present in the id list but with no llm_calls rows does not count in the average', () => {
    // Simula: recentSessionIds trajo 2 ids, pero solo una tiene llamadas.
    const rows = [row({ session_id: 's1' })];
    expect(aggregateTokensBySession(rows)).toEqual({ avgTokensIn: 100, avgTokensOut: 50 });
  });
});
