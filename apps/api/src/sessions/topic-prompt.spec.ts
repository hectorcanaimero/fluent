import { TOPICS } from '../content/index.js';
import { findTopicByTitle, resolveFreeTopicPrompt } from './topic-prompt.js';

const CATALOG_TOPIC = TOPICS[0]!;

describe('resolveFreeTopicPrompt', () => {
  it('devuelve el `prompt_en` cuando el texto es exactamente un `title_es` del catálogo', () => {
    expect(resolveFreeTopicPrompt(CATALOG_TOPIC.title_es)).toBe(CATALOG_TOPIC.prompt_en);
  });

  it('devuelve el texto tal cual cuando no está en el catálogo', () => {
    expect(resolveFreeTopicPrompt('Mi viaje a Japón')).toBe('Mi viaje a Japón');
  });

  it('la comparación es exacta: distinto caso o espacios no casan', () => {
    const shouted = CATALOG_TOPIC.title_es.toUpperCase();
    expect(resolveFreeTopicPrompt(shouted)).toBe(shouted);
    expect(resolveFreeTopicPrompt(`${CATALOG_TOPIC.title_es} `)).toBe(
      `${CATALOG_TOPIC.title_es} `,
    );
  });

  it('nunca devuelve cadena vacía para un texto no vacío', () => {
    expect(resolveFreeTopicPrompt('x')).toBe('x');
  });
});

describe('findTopicByTitle', () => {
  it('encuentra la entrada del catálogo', () => {
    expect(findTopicByTitle(CATALOG_TOPIC.title_es)?.id).toBe(CATALOG_TOPIC.id);
  });

  it('devuelve undefined si no existe', () => {
    expect(findTopicByTitle('nada-de-esto')).toBeUndefined();
  });
});
