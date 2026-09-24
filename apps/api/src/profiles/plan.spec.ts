import { effectivePlan, isPro } from './plan.js';

const now = new Date('2026-09-23T12:00:00Z');

describe('plan', () => {
  it('free', () => {
    expect(isPro({ plan: 'free', plan_expires_at: null }, now)).toBe(false);
    expect(effectivePlan({ plan: 'free', plan_expires_at: '2030-01-01T00:00:00Z' }, now)).toBe('free');
  });
  it('pro sin fecha', () => {
    expect(isPro({ plan: 'pro', plan_expires_at: null }, now)).toBe(true);
  });
  it('pro vigente', () => {
    expect(effectivePlan({ plan: 'pro', plan_expires_at: '2026-09-24T00:00:00Z' }, now)).toBe('pro');
  });
  it('pro vencido', () => {
    expect(isPro({ plan: 'pro', plan_expires_at: '2026-09-22T00:00:00Z' }, now)).toBe(false);
    expect(effectivePlan({ plan: 'pro', plan_expires_at: now.toISOString() }, now)).toBe('free');
  });
  it('fecha inválida cuenta como free', () => {
    expect(isPro({ plan: 'pro', plan_expires_at: 'no-es-fecha' }, now)).toBe(false);
  });
});
