import { levelToSuggest } from './level-rule.js';

describe('levelToSuggest (SPEC-05 §2, regla de nivel)', () => {
  it('sugiere el nivel tras tres briefs consecutivos con el mismo level_hint', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B2',
        previousLevelHints: ['B2', 'B2'],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBe('B2');
  });

  it('no sugiere nada si el level_hint coincide con el nivel del perfil', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B1',
        previousLevelHints: ['B1', 'B1'],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBeNull();
  });

  it('no sugiere nada si solo hay dos briefs consecutivos', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B2',
        previousLevelHints: ['B2'],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBeNull();
  });

  it('no sugiere nada si la racha se rompe', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B2',
        previousLevelHints: ['B2', 'A2'],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBeNull();
  });

  it('no sugiere nada si algún brief anterior no tiene level_hint', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'A2',
        previousLevelHints: ['A2', null],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBeNull();
  });

  it('no sugiere nada si el brief recién aplicado no trae level_hint', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: null,
        previousLevelHints: [null, null],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBeNull();
  });

  it('no reescribe una sugerencia idéntica ya guardada', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B2',
        previousLevelHints: ['B2', 'B2'],
        profileLevel: 'B1',
        currentSuggestedLevel: 'B2',
      }),
    ).toBeNull();
  });

  it('reemplaza una sugerencia anterior distinta', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'A2',
        previousLevelHints: ['A2', 'A2'],
        profileLevel: 'B1',
        currentSuggestedLevel: 'B2',
      }),
    ).toBe('A2');
  });

  it('solo mira las dos entradas más recientes del histórico', () => {
    expect(
      levelToSuggest({
        appliedLevelHint: 'B2',
        previousLevelHints: ['B2', 'B2', 'A2', 'A2'],
        profileLevel: 'B1',
        currentSuggestedLevel: null,
      }),
    ).toBe('B2');
  });
});
