import type { CatalogModel } from '../llm/catalog.service.js';
import { buildEstimatePerSession, groupModelsByProviderAndTier } from './models.mapper.js';

function model(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id: 'some/model',
    provider: '9router',
    name: 'Some Model',
    contextLength: 100_000,
    pricePerMillionIn: 1,
    pricePerMillionOut: 2,
    tier: 'budget',
    ...overrides,
  };
}

describe('groupModelsByProviderAndTier', () => {
  it('always returns the 9router key with the three tiers, even when empty', () => {
    const result = groupModelsByProviderAndTier([]);

    expect(Object.keys(result)).toEqual(['9router']);
    expect(result['9router']).toEqual({ free: [], budget: [], premium: [] });
  });

  it('groups each model under its tier', () => {
    const result = groupModelsByProviderAndTier([
      model({ id: 'a', tier: 'free' }),
      model({ id: 'b', tier: 'budget' }),
      model({ id: 'c', tier: 'premium', name: 'C' }),
    ]);

    expect(result['9router'].free).toEqual([{ id: 'a', name: 'Some Model', pricePerMillionUsd: 2 }]);
    expect(result['9router'].budget).toEqual([{ id: 'b', name: 'Some Model', pricePerMillionUsd: 2 }]);
    expect(result['9router'].premium).toEqual([{ id: 'c', name: 'C', pricePerMillionUsd: 2 }]);
  });

  it('the exact DTO shape of an element is {id, name, pricePerMillionUsd} — the output price, not the input one', () => {
    const result = groupModelsByProviderAndTier([
      model({ id: 'm', name: 'M', pricePerMillionIn: 0.1, pricePerMillionOut: 7 }),
    ]);

    expect(result['9router'].budget).toEqual([{ id: 'm', name: 'M', pricePerMillionUsd: 7 }]);
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
