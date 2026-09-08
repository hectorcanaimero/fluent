import { computeTopTopics } from './top-topics.js';

describe('computeTopTopics (SPEC-05 §4 paso 2)', () => {
  it('devuelve los 3 temas más frecuentes, de mayor a menor', () => {
    const topics = ['travel', 'food', 'travel', 'sports', 'travel', 'food'];
    expect(computeTopTopics(topics)).toEqual(['travel', 'food', 'sports']);
  });

  it('desempata alfabéticamente cuando la frecuencia es igual', () => {
    const topics = ['zebra', 'apple', 'mango'];
    expect(computeTopTopics(topics)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('devuelve menos de 3 si no hay suficientes temas distintos', () => {
    expect(computeTopTopics(['travel', 'travel'])).toEqual(['travel']);
  });

  it('devuelve [] sin temas', () => {
    expect(computeTopTopics([])).toEqual([]);
  });
});
