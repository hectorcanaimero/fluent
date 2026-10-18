import { detects, latencyPercentiles } from './bench.js';

const correction = (
  original: string,
  category: 'articles' | 'other' = 'other',
) => ({
  original,
  corrected: 'x',
  category,
  note: '',
});

describe('detects', () => {
  const planted = {
    category: 'past_simple',
    trigger: 'I go yesterday',
  } as const;

  it('detecta por categoría o por solapamiento del fragmento', () => {
    expect(
      detects(planted, [{ ...correction('zzz'), category: 'past_simple' }]),
    ).toBe(true);
    expect(detects(planted, [correction('i go yesterday to the')])).toBe(true);
    expect(detects(planted, [correction('go')])).toBe(true);
  });

  it('ignora un original que queda vacío al normalizar', () => {
    expect(detects(planted, [correction('?!')])).toBe(false);
    expect(detects(planted, [correction('...', 'articles')])).toBe(false);
  });
});

describe('latencyPercentiles', () => {
  it('incluye las latencias de los intentos fallidos', () => {
    const ok = Array.from({ length: 8 }, () => ({
      latencyMs: 1000,
      validJson: true,
    }));
    const timeouts = Array.from({ length: 2 }, () => ({
      latencyMs: 20_000,
      validJson: false,
    }));
    expect(latencyPercentiles([...ok, ...timeouts])).toEqual({
      p50: 1000,
      p90: 20_000,
    });
  });

  it('devuelve 0 sin intentos', () => {
    expect(latencyPercentiles([])).toEqual({ p50: 0, p90: 0 });
  });
});
