import { buildInterestKeywords, matchInterestTags } from './tags.js';

const INTERESTS_FIXTURE = [
  { id: 'football', tags: ['soccer', 'competition', 'exploration'] },
  { id: 'space', tags: ['astronomy', 'exploration', 'discovery'] },
  { id: 'artificial-intelligence', tags: ['ai', 'automation', 'research'] },
];

describe('buildInterestKeywords', () => {
  it('incluye los tags del catálogo', () => {
    const keywords = buildInterestKeywords(INTERESTS_FIXTURE);
    expect(keywords.has('soccer')).toBe(true);
    expect(keywords.has('astronomy')).toBe(true);
    expect(keywords.has('ai')).toBe(true);
  });

  it('incluye las palabras del id partido por guiones', () => {
    const keywords = buildInterestKeywords(INTERESTS_FIXTURE);
    // "football" y "space" no son tags de esos intereses, solo ids.
    expect(keywords.has('football')).toBe(true);
    expect(keywords.has('space')).toBe(true);
    // "artificial-intelligence" se parte en dos palabras.
    expect(keywords.has('artificial')).toBe(true);
    expect(keywords.has('intelligence')).toBe(true);
    expect(keywords.has('artificial-intelligence')).toBe(false);
  });
});

describe('matchInterestTags', () => {
  const keywords = buildInterestKeywords(INTERESTS_FIXTURE);

  it('matchea por palabra completa, case-insensitive', () => {
    expect(matchInterestTags('Local team wins football championship', keywords)).toEqual([
      'football',
    ]);
    expect(matchInterestTags('Breakthrough AI chip unveiled', keywords)).toEqual(['ai']);
  });

  it('no matchea substrings dentro de otra palabra', () => {
    // "biologists" contiene "ai" en ninguna parte pero probamos con algo real:
    // "said" contiene "ai" como substring, no debe matchear la palabra "ai".
    expect(matchInterestTags('The manager said the plan works', keywords)).toEqual([]);
  });

  it('devuelve varias coincidencias ordenadas', () => {
    expect(
      matchInterestTags('New discovery about space exploration', keywords),
    ).toEqual(['discovery', 'exploration', 'space']);
  });

  it('devuelve vacío si no hay coincidencias', () => {
    expect(matchInterestTags('A quiet afternoon downtown', keywords)).toEqual([]);
  });
});
