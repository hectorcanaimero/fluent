import type { CatalogModel } from '../llm/catalog.service.js';
import { buildEstimatePerSession, groupModelsByProviderAndTier } from './models.mapper.js';

function model(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id: 'some/model',
    provider: 'openrouter',
    name: 'Some Model',
    contextLength: 100_000,
    pricePerMillionIn: 1,
    pricePerMillionOut: 2,
    tier: 'budget',
    ...overrides,
  };
}

describe('groupModelsByProviderAndTier', () => {
  it('always returns the two provider keys with the three tiers, even when empty', () => {
    const result = groupModelsByProviderAndTier([]);

    expect(Object.keys(result).sort()).toEqual(['gemini', 'openrouter']);
    expect(result.openrouter).toEqual({ free: [], budget: [], premium: [] });
    expect(result.gemini).toEqual({ free: [], budget: [], premium: [] });
  });

  it('groups each model under its provider and tier', () => {
    const freeOpenRouter = model({ id: 'or/free', provider: 'openrouter', tier: 'free' });
    const budgetOpenRouter = model({ id: 'or/budget', provider: 'openrouter', tier: 'budget' });
    const premiumGemini = model({
      id: 'gemini-2.5-pro',
      provider: 'gemini',
      tier: 'premium',
      name: 'Gemini 2.5 Pro',
    });

    const result = groupModelsByProviderAndTier([freeOpenRouter, budgetOpenRouter, premiumGemini]);

    expect(result.openrouter.free).toEqual([
      { id: 'or/free', name: 'Some Model', pricePerMillionUsd: 2 },
    ]);
    expect(result.openrouter.budget).toEqual([
      { id: 'or/budget', name: 'Some Model', pricePerMillionUsd: 2 },
    ]);
    expect(result.openrouter.premium).toEqual([]);
    expect(result.gemini.premium).toEqual([
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', pricePerMillionUsd: 2 },
    ]);
    expect(result.gemini.free).toEqual([]);
  });

  it('the exact DTO shape of an element is {id, name, pricePerMillionUsd} — the output price, not the input one', () => {
    const cheapIn = model({ id: 'm', name: 'M', pricePerMillionIn: 0.1, pricePerMillionOut: 7 });

    const result = groupModelsByProviderAndTier([cheapIn]);

    expect(result.openrouter.budget).toEqual([{ id: 'm', name: 'M', pricePerMillionUsd: 7 }]);
    // No debe colarse ningún otro campo (contextLength, tier, pricePerMillionIn...).
    expect(Object.keys(result.openrouter.budget[0]!).sort()).toEqual([
      'id',
      'name',
      'pricePerMillionUsd',
    ]);
  });
});

describe('buildEstimatePerSession', () => {
  it('has one entry per model, keyed by model id', () => {
    const models = [
      model({ id: 'a', pricePerMillionIn: 1, pricePerMillionOut: 2 }),
      model({ id: 'b', pricePerMillionIn: 3, pricePerMillionOut: 4 }),
    ];
    const estimate = vi.fn((avgIn: number, avgOut: number, m: CatalogModel) =>
      avgIn * m.pricePerMillionIn + avgOut * m.pricePerMillionOut,
    );

    const result = buildEstimatePerSession(models, 1000, 500, estimate);

    expect(Object.keys(result).sort()).toEqual(['a', 'b']);
    expect(result.a).toBe(1000 * 1 + 500 * 2);
    expect(result.b).toBe(1000 * 3 + 500 * 4);
    expect(estimate).toHaveBeenCalledTimes(2);
    expect(estimate).toHaveBeenCalledWith(1000, 500, models[0]);
  });

  it('returns an empty object for an empty catalog', () => {
    expect(buildEstimatePerSession([], 9000, 2500, () => 1)).toEqual({});
  });
});
