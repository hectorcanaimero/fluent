import { DEFAULT_FALLBACK_MODELS, parseFallbackModels } from './config.js';
import { ModelResolver, type ActiveCredential } from './model-resolver.js';

const OPENROUTER: ActiveCredential = { provider: 'openrouter', apiKey: 'or-key' };
const GEMINI: ActiveCredential = { provider: 'gemini', apiKey: 'gem-key' };

const FALLBACKS = [
  { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
  { provider: 'openrouter' as const, model: 'google/gemma-3-27b-it:free' },
  { provider: 'openrouter' as const, model: 'meta-llama/llama-3.3-70b-instruct:free' },
];

describe('ModelResolver', () => {
  it('pone la preferencia del usuario primero y luego la cadena gratuita', () => {
    const resolver = new ModelResolver(FALLBACKS);
    const { candidates, preferenceDropped } = resolver.resolve({
      credentials: [OPENROUTER, GEMINI],
      preference: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4' },
    });

    expect(preferenceDropped).toBe(false);
    expect(candidates.map((c) => `${c.provider}:${c.model}`)).toEqual([
      'openrouter:anthropic/claude-sonnet-4',
      'gemini:gemini-2.5-flash',
      'openrouter:google/gemma-3-27b-it:free',
      'openrouter:meta-llama/llama-3.3-70b-instruct:free',
    ]);
    expect(candidates[0]?.source).toBe('preference');
    expect(candidates[1]?.source).toBe('fallback');
    expect(candidates[0]?.apiKey).toBe('or-key');
    expect(candidates[1]?.apiKey).toBe('gem-key');
  });

  it('filtra la cadena a los proveedores con credencial activa', () => {
    const resolver = new ModelResolver(FALLBACKS);
    const { candidates } = resolver.resolve({ credentials: [GEMINI] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.provider).toBe('gemini');
  });

  it('marca preferenceDropped si no hay credencial del proveedor elegido', () => {
    const resolver = new ModelResolver(FALLBACKS);
    const { candidates, preferenceDropped } = resolver.resolve({
      credentials: [GEMINI],
      preference: { provider: 'openrouter', model: 'openai/gpt-4o' },
    });

    expect(preferenceDropped).toBe(true);
    expect(candidates.every((c) => c.source === 'fallback')).toBe(true);
  });

  it('no repite el modelo preferido si también está en la cadena', () => {
    const resolver = new ModelResolver(FALLBACKS);
    const { candidates } = resolver.resolve({
      credentials: [GEMINI],
      preference: { provider: 'gemini', model: 'gemini-2.5-flash' },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.source).toBe('preference');
  });

  it('devuelve lista vacía sin credenciales', () => {
    const resolver = new ModelResolver(FALLBACKS);
    expect(resolver.resolve({ credentials: [] }).candidates).toEqual([]);
  });

  it('permite sobreescribir la cadena por llamada', () => {
    const resolver = new ModelResolver(FALLBACKS);
    const { candidates } = resolver.resolve({
      credentials: [OPENROUTER],
      fallbackModels: [{ provider: 'openrouter', model: 'solo/este:free' }],
    });

    expect(candidates.map((c) => c.model)).toEqual(['solo/este:free']);
  });
});

describe('parseFallbackModels', () => {
  it('usa el valor por defecto si la variable falta, está vacía o es basura', () => {
    expect(parseFallbackModels(undefined)).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('   ')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('no es json')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('{"provider":"gemini"}')).toBe(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels('[{"provider":"otro","model":"x"}]')).toBe(DEFAULT_FALLBACK_MODELS);
  });

  it('acepta una lista válida y descarta las entradas mal formadas', () => {
    const parsed = parseFallbackModels(
      '[{"provider":"9router","model":"fluent-pro"},{"provider":"x","model":"y"},{"provider":"gemini","model":"a"}]',
    );
    expect(parsed).toEqual([
      { provider: '9router', model: 'fluent-pro' },
    ]);
  });
});
