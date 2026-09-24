import { validateEnv } from './env.js';

/** Entorno mínimo válido, con valores de juguete (nunca secretos reales). */
function baseEnv(): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    INSFORGE_URL: 'https://example.test.insforge.app',
    INSFORGE_API_KEY: 'fake',
    INSFORGE_ANON_KEY: 'fake',
    REDIS_URL: 'redis://localhost:6379',
    NINEROUTER_URL: 'http://localhost:20128/v1',
    NINEROUTER_API_KEY: 'fake',
    FALLBACK_MODELS: '[]',
    PROMPT_VERSION: '1',
    OWNER_USER_ID: '9595625c-aea8-4120-accc-ed149d0a84c6',
  };
}

describe('NINEROUTER_*', () => {
  it('tumba el arranque si falta NINEROUTER_URL', () => {
    const { NINEROUTER_URL: _omit, ...env } = baseEnv();
    expect(() => validateEnv(env)).toThrow();
  });

  it('tumba el arranque si falta NINEROUTER_API_KEY', () => {
    const { NINEROUTER_API_KEY: _omit, ...env } = baseEnv();
    expect(() => validateEnv(env)).toThrow();
  });

  it('FALLBACK_MODELS es opcional', () => {
    const { FALLBACK_MODELS: _omit, ...env } = baseEnv();
    expect(validateEnv(env).FALLBACK_MODELS).toBeUndefined();
  });
});
