import { BOSS_TOPICS, ROLEPLAYS, TOPICS } from '../content/index.js';
import type { NewsItem, Session } from '../db/schema.js';
import { buildTurnSystemPrompt } from '../llm/prompts/turn.js';
import {
  bossScenario,
  freeTopicScenario,
  newsScenario,
  rebuildScenario,
  roleplayScenario,
} from './scenario.js';

const ROLEPLAY = ROLEPLAYS[0]!;
const BOSS_TOPIC = BOSS_TOPICS[0]!;
const CATALOG_TOPIC = TOPICS[0]!;

function sessionRow(
  overrides: Partial<Pick<Session, 'kind' | 'topic' | 'news_item_id'>> = {},
): Pick<Session, 'kind' | 'topic' | 'news_item_id'> {
  return {
    kind: 'free_topic',
    topic: 'Mis vacaciones',
    news_item_id: null,
    ...overrides,
  };
}

function newsRow(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    source: 'BBC World',
    url: 'https://example.test/news',
    title: 'Solar power beats coal in Europe',
    summary: 'Solar overtook coal for the first time.',
    tags: ['science'],
    published_at: '2026-09-08T10:00:00.000Z',
    day: '2026-09-08',
    ...overrides,
  };
}

describe('constructores de escenario (SPEC-04 §3.2)', () => {
  it('free_topic con un tema del catálogo traduce a su `prompt_en`', () => {
    expect(freeTopicScenario(CATALOG_TOPIC.title_es)).toEqual({
      topic: CATALOG_TOPIC.title_es,
      promptTopic: CATALOG_TOPIC.prompt_en,
    });
  });

  it('free_topic escrito a mano deja el texto tal cual', () => {
    expect(freeTopicScenario('Mi perro Lolo')).toEqual({
      topic: 'Mi perro Lolo',
      promptTopic: 'Mi perro Lolo',
    });
  });

  it('roleplay guarda `title_es` y manda rol y situación', () => {
    expect(roleplayScenario(ROLEPLAY)).toEqual({
      topic: ROLEPLAY.title_es,
      roleplay: { role: ROLEPLAY.role, situation: ROLEPLAY.situation },
    });
  });

  it('news guarda el titular y el id de la noticia', () => {
    const item = newsRow();
    expect(newsScenario(item)).toEqual({
      topic: item.title,
      news: { title: item.title, summary: item.summary },
      newsItemId: item.id,
    });
  });

  it('news sin resumen manda cadena vacía, no `null`', () => {
    expect(newsScenario(newsRow({ summary: null })).news).toEqual({
      title: 'Solar power beats coal in Europe',
      summary: '',
    });
  });

  it('boss guarda `title_es` y manda `prompt_en`', () => {
    expect(bossScenario(BOSS_TOPIC)).toEqual({
      topic: BOSS_TOPIC.title_es,
      promptTopic: BOSS_TOPIC.prompt_en,
    });
  });
});

describe('rebuildScenario (SPEC-04 §4: mismo escenario en cada turno)', () => {
  it('free_topic se reconstruye desde `sessions.topic`', () => {
    const scenario = rebuildScenario(sessionRow({ topic: CATALOG_TOPIC.title_es }));

    expect(scenario).toEqual({
      kind: 'free_topic',
      fallback: false,
      topic: CATALOG_TOPIC.title_es,
      promptTopic: CATALOG_TOPIC.prompt_en,
    });
  });

  it('roleplay se reconstruye buscando el `title_es` en ROLEPLAYS', () => {
    const scenario = rebuildScenario(
      sessionRow({ kind: 'roleplay', topic: ROLEPLAY.title_es }),
    );

    expect(scenario).toMatchObject({
      kind: 'roleplay',
      fallback: false,
      roleplay: { role: ROLEPLAY.role, situation: ROLEPLAY.situation },
    });
  });

  it('boss se reconstruye buscando el `title_es` en BOSS_TOPICS', () => {
    const scenario = rebuildScenario(
      sessionRow({ kind: 'boss', topic: BOSS_TOPIC.title_es }),
    );

    expect(scenario).toMatchObject({
      kind: 'boss',
      fallback: false,
      promptTopic: BOSS_TOPIC.prompt_en,
    });
  });

  it('news se reconstruye con la fila que se vuelve a leer', () => {
    const item = newsRow();
    const scenario = rebuildScenario(
      sessionRow({ kind: 'news', topic: item.title, news_item_id: item.id }),
      item,
    );

    expect(scenario).toMatchObject({
      kind: 'news',
      fallback: false,
      news: { title: item.title, summary: item.summary },
    });
  });

  it('news con la noticia ya purgada cae a free_topic con el topic guardado', () => {
    const scenario = rebuildScenario(
      sessionRow({
        kind: 'news',
        topic: 'Solar power beats coal in Europe',
        news_item_id: '44444444-4444-4444-8444-444444444444',
      }),
      null,
    );

    expect(scenario).toEqual({
      kind: 'free_topic',
      fallback: true,
      topic: 'Solar power beats coal in Europe',
      promptTopic: 'Solar power beats coal in Europe',
    });
    expect(scenario.news).toBeUndefined();
  });

  it('roleplay cuyo `title_es` ya no existe en el catálogo cae a free_topic', () => {
    const scenario = rebuildScenario(
      sessionRow({ kind: 'roleplay', topic: 'Un escenario que ya no existe' }),
    );

    expect(scenario).toMatchObject({ kind: 'free_topic', fallback: true });
    expect(scenario.roleplay).toBeUndefined();
  });

  it('boss cuyo `title_es` ya no existe en el catálogo cae a free_topic', () => {
    const scenario = rebuildScenario(
      sessionRow({ kind: 'boss', topic: 'Un reto que ya no existe' }),
    );

    expect(scenario).toMatchObject({ kind: 'free_topic', fallback: true });
  });

  it('el `kind` degradado es el que ve el prompt, no el de la fila', () => {
    const scenario = rebuildScenario(
      sessionRow({ kind: 'boss', topic: 'Un reto que ya no existe' }),
    );

    const prompt = buildTurnSystemPrompt({
      locale: 'es',
      level: 'B1',
      kind: scenario.kind,
      topic: scenario.promptTopic,
      roleplay: scenario.roleplay,
      news: scenario.news,
    });

    expect(prompt).toContain('Session type: free_topic. Topic: Un reto que ya no existe.');
    expect(prompt).not.toContain('Challenge session');
  });
});
