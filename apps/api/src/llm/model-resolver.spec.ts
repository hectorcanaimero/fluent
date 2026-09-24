import { DEFAULT_FALLBACK_MODELS, parseFallbackModels } from './config.js';
import { ModelResolver } from './model-resolver.js';

const PREFERENCE = { provider: '9router' as const, model: 'cc/claude-sonnet-4-6' };

function models(result: ReturnType<ModelResolver['resolve']>): string[] {
  return result.candidates.map((c) => `${c.source}:${c.model}`);
}

describe('ModelResolver', () => {
  const resolver = new ModelResolver();

  it('free sin preferencia: solo fluent-free', () => {
    const result = resolver.resolve({ plan: 'free' });
    expect(models(result)).toEqual(['fallback:fluent-free']);
    expect(result.preferenceDropped).toBe(false);
  });

  it('free con preferencia: la descarta y marca preferenceDropped', () => {
    const result = resolver.resolve({ plan: 'free', preference: PREFERENCE });
    expect(models(result)).toEqual(['fallback:fluent-free']);
    expect(result.preferenceDropped).toBe(true);
  });

  it('pro sin preferencia: fluent-pro y luego fluent-free', () => {
    const result = resolver.resolve({ plan: 'pro', preference: null });
    expect(models(result)).toEqual(['fallback:fluent-pro', 'fallback:fluent-free']);
    expect(result.preferenceDropped).toBe(false);
  });

  it('pro con preferencia: preferencia primero, luego la cadena', () => {
    const result = resolver.resolve({ plan: 'pro', preference: PREFERENCE });
    expect(models(result)).toEqual([
      'preference:cc/claude-sonnet-4-6',
      'fallback:fluent-pro',
      'fallback:fluent-free',
    ]);
    expect(result.preferenceDropped).toBe(false);
  });

  it('pro no repite el modelo preferido si ya está en la cadena', () => {
    const result = resolver.resolve({
      plan: 'pro',
      preference: { provider: '9router', model: 'fluent-pro' },
    });
    expect(models(result)).toEqual(['preference:fluent-pro', 'fallback:fluent-free']);
  });

  it('pro añade al final la cadena del operador', () => {
    const result = resolver.resolve({
      plan: 'pro',
      fallbackModels: [{ provider: '9router', model: 'extra/modelo' }],
    });
    expect(models(result)).toEqual([
      'fallback:fluent-pro',
      'fallback:fluent-free',
      'fallback:extra/modelo',
    ]);
  });
});

describe('parseFallbackModels', () => {
  it('usa el valor por defecto si la variable falta, está vacía o es basura', () => {
    expect(parseFallbackModels(undefined)).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('   ')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('no es json')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('{"provider":"x"}')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('[{"provider":"otro","model":"x"}]')).toBe(DEFAULT_FALLBACK_MODELS);
  });

  it('acepta una lista válida y descarta las entradas mal formadas', () => {
    const parsed = parseFallbackModels(
      '[{"provider":"9router","model":"fluent-pro"},{"provider":"x","model":"y"},{"provider":"x","model":"a"}]',
    );
    expect(parsed).toEqual([
      { provider: '9router', model: 'fluent-pro' },
    ]);
  });
});
