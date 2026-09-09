import type { Interest, NewsItem, Roleplay, Topic } from '../content/index.js';
import type { SessionRandom } from './sessions.constants.js';
import {
  interestTagSet,
  pickSuggestedNews,
  pickSuggestedRoleplays,
  pickSuggestedTopics,
  shuffle,
} from './suggestions.selectors.js';

/** Siempre devuelve el mismo valor: barajado determinista para los tests. */
function fixedRandom(value = 0): SessionRandom {
  return () => value;
}

function topic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    title_es: 'Tema 1',
    prompt_en: 'Prompt 1',
    tags: ['tech'],
    level_min: 'A2',
    ...overrides,
  };
}

function roleplay(overrides: Partial<Roleplay> = {}): Roleplay {
  return {
    id: 'role-1',
    title_es: 'Escenario 1',
    role: 'Waiter',
    situation: 'A restaurant',
    level_min: 'A2',
    ...overrides,
  };
}

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'news-1',
    source: 'BBC',
    url: 'https://example.test/1',
    title: 'Noticia 1',
    summary: null,
    tags: ['tech'],
    published_at: '2026-09-08T00:00:00.000Z',
    day: '2026-09-08',
    ...overrides,
  };
}

describe('shuffle', () => {
  it('no muta el array original', () => {
    const items = [1, 2, 3, 4];
    shuffle(items, fixedRandom(0));
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('devuelve los mismos elementos, en algún orden', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(items, fixedRandom(0.5));
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('es determinista con la misma fuente de aleatoriedad', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(shuffle(items, fixedRandom(0))).toEqual(shuffle(items, fixedRandom(0)));
  });
});

describe('interestTagSet', () => {
  const catalog: Interest[] = [
    { id: 'technology', label_es: 'Tecnología', label_pt: 'Tecnologia', tags: ['tech', 'coding'] },
    { id: 'football', label_es: 'Fútbol', label_pt: 'Futebol', tags: ['soccer', 'competition'] },
  ];

  it('traduce ids de INTERESTS a la unión de sus tags', () => {
    expect(interestTagSet(['technology', 'football'], catalog)).toEqual(
      new Set(['tech', 'coding', 'soccer', 'competition']),
    );
  });

  it('ignora ids que no existen en el catálogo', () => {
    expect(interestTagSet(['no-existe'], catalog)).toEqual(new Set());
  });

  it('lista vacía de intereses da un conjunto vacío', () => {
    expect(interestTagSet([], catalog)).toEqual(new Set());
  });
});

describe('pickSuggestedTopics', () => {
  it('devuelve 6 que casan con los intereses y 2 que no (8 en total)', () => {
    const matching = Array.from({ length: 6 }, (_unused, i) =>
      topic({ id: `m${i}`, title_es: `Match ${i}`, tags: ['tech'] }),
    );
    const outside = Array.from({ length: 6 }, (_unused, i) =>
      topic({ id: `o${i}`, title_es: `Outside ${i}`, tags: ['soccer'] }),
    );

    const result = pickSuggestedTopics(
      [...matching, ...outside],
      new Set(['tech']),
      'B2',
      fixedRandom(0),
    );

    expect(result).toHaveLength(8);
    const matchingTitles = new Set(matching.map((t) => t.title_es));
    const outsideTitles = new Set(outside.map((t) => t.title_es));
    const matchingCount = result.filter((title) => matchingTitles.has(title)).length;
    const outsideCount = result.filter((title) => outsideTitles.has(title)).length;
    expect(matchingCount).toBe(6);
    expect(outsideCount).toBe(2);
  });

  it('filtra por nivel alcanzable (level_min <= level)', () => {
    const reachable = topic({ id: 'a2', title_es: 'A2 topic', level_min: 'A2', tags: ['tech'] });
    const tooHard = topic({ id: 'b2', title_es: 'B2 topic', level_min: 'B2', tags: ['tech'] });

    const result = pickSuggestedTopics([reachable, tooHard], new Set(['tech']), 'A2', fixedRandom(0));

    expect(result).toContain('A2 topic');
    expect(result).not.toContain('B2 topic');
  });

  it('con menos de 6 coincidencias, completa con temas fuera de intereses hasta 8', () => {
    const matching = [topic({ id: 'm0', title_es: 'Match 0', tags: ['tech'] })];
    const outside = Array.from({ length: 10 }, (_unused, i) =>
      topic({ id: `o${i}`, title_es: `Outside ${i}`, tags: ['soccer'] }),
    );

    const result = pickSuggestedTopics(
      [...matching, ...outside],
      new Set(['tech']),
      'B2',
      fixedRandom(0),
    );

    expect(result).toHaveLength(8);
    expect(result).toContain('Match 0');
  });

  it('nunca repite un mismo tema', () => {
    const topics = Array.from({ length: 8 }, (_unused, i) =>
      topic({ id: `t${i}`, title_es: `Tema ${i}`, tags: ['tech'] }),
    );

    const result = pickSuggestedTopics(topics, new Set(['tech']), 'B2', fixedRandom(0));

    expect(new Set(result).size).toBe(result.length);
  });

  it('con un catálogo pequeño, devuelve menos de 8 sin fallar', () => {
    const topics = [topic({ id: 't0', title_es: 'Único', tags: ['tech'] })];
    const result = pickSuggestedTopics(topics, new Set(['tech']), 'B2', fixedRandom(0));
    expect(result).toEqual(['Único']);
  });
});

describe('pickSuggestedRoleplays', () => {
  it('excluye los títulos recientes', () => {
    const roleplays = Array.from({ length: 5 }, (_unused, i) =>
      roleplay({ id: `r${i}`, title_es: `Escenario ${i}` }),
    );
    const recent = new Set(['Escenario 0', 'Escenario 1']);

    const result = pickSuggestedRoleplays(roleplays, 'B2', recent);

    expect(result.map((r) => r.title_es)).not.toEqual(
      expect.arrayContaining(['Escenario 0', 'Escenario 1']),
    );
  });

  it('devuelve como máximo 4', () => {
    const roleplays = Array.from({ length: 10 }, (_unused, i) =>
      roleplay({ id: `r${i}`, title_es: `Escenario ${i}` }),
    );
    const result = pickSuggestedRoleplays(roleplays, 'B2', new Set());
    expect(result).toHaveLength(4);
  });

  it('filtra por nivel alcanzable', () => {
    const reachable = roleplay({ id: 'a2', title_es: 'A2 role', level_min: 'A2' });
    const tooHard = roleplay({ id: 'b2', title_es: 'B2 role', level_min: 'B2' });
    const result = pickSuggestedRoleplays([reachable, tooHard], 'A2', new Set());
    expect(result.map((r) => r.title_es)).toEqual(['A2 role']);
  });

  it('si excluir los recientes deja menos de 4, completa repitiendo recientes', () => {
    const roleplays = Array.from({ length: 3 }, (_unused, i) =>
      roleplay({ id: `r${i}`, title_es: `Escenario ${i}` }),
    );
    const recent = new Set(['Escenario 0', 'Escenario 1', 'Escenario 2']);

    const result = pickSuggestedRoleplays(roleplays, 'B2', recent);

    expect(result).toHaveLength(3); // no hay más de 3 en el catálogo de test
  });
});

describe('pickSuggestedNews', () => {
  it('prioriza las que casan con los intereses', () => {
    const matching = newsItem({ id: 'n1', title: 'Match', tags: ['tech'] });
    const outside = newsItem({ id: 'n2', title: 'Outside', tags: ['soccer'] });

    const result = pickSuggestedNews([outside, matching], new Set(['tech']));

    expect(result.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('con menos de 4 coincidencias, completa con las más recientes sin repetir', () => {
    const matching = newsItem({ id: 'match', tags: ['tech'] });
    const others = Array.from({ length: 5 }, (_unused, i) =>
      newsItem({ id: `other-${i}`, tags: ['soccer'] }),
    );

    const result = pickSuggestedNews([matching, ...others], new Set(['tech']));

    expect(result).toHaveLength(4);
    expect(result[0]!.id).toBe('match');
    expect(new Set(result.map((n) => n.id)).size).toBe(4);
  });

  it('devuelve como máximo 4', () => {
    const items = Array.from({ length: 10 }, (_unused, i) => newsItem({ id: `n${i}`, tags: ['tech'] }));
    const result = pickSuggestedNews(items, new Set(['tech']));
    expect(result).toHaveLength(4);
  });
});
