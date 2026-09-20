import { randomBytes } from 'node:crypto';
import { PRODUCTION_API_PUBLIC_URL, suspiciousEnvWarnings, validateEnv } from './env.js';

/** Entorno mínimo válido, con valores de juguete (nunca secretos reales). */
function baseEnv(): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    INSFORGE_URL: 'https://example.test.insforge.app',
    INSFORGE_API_KEY: 'fake',
    INSFORGE_ANON_KEY: 'fake',
    REDIS_URL: 'redis://localhost:6379',
    CREDENTIALS_MASTER_KEY: randomBytes(32).toString('base64'),
    OPENROUTER_OAUTH_CALLBACK: 'fluent://oauth/openrouter',
    FALLBACK_MODELS: '[]',
    PROMPT_VERSION: '1',
    OWNER_USER_ID: '9595625c-aea8-4120-accc-ed149d0a84c6',
  };
}

describe('validateEnv · CREDENTIALS_MASTER_KEY_PREVIOUS (rotación, SPEC-02 §5)', () => {
  it('accepts the variable being absent', () => {
    expect(validateEnv(baseEnv()).CREDENTIALS_MASTER_KEY_PREVIOUS).toBeUndefined();
  });

  it('treats an empty value as "not configured" (dotenv entrega `CLAVE=` como cadena vacía)', () => {
    const env = { ...baseEnv(), CREDENTIALS_MASTER_KEY_PREVIOUS: '' };

    expect(validateEnv(env).CREDENTIALS_MASTER_KEY_PREVIOUS).toBeUndefined();
  });

  it('keeps the previous key when it is set', () => {
    const previous = randomBytes(32).toString('base64');
    const env = { ...baseEnv(), CREDENTIALS_MASTER_KEY_PREVIOUS: previous };

    expect(validateEnv(env).CREDENTIALS_MASTER_KEY_PREVIOUS).toBe(previous);
  });
});

describe('OPENROUTER_OAUTH_CALLBACK', () => {
  it('rechaza cualquier cosa que no sea un deep link o https (una API key, por ejemplo)', () => {
    expect(() =>
      validateEnv({ ...baseEnv(), OPENROUTER_OAUTH_CALLBACK: 'sk-or-v1-loquesea' }),
    ).toThrow();
  });

  it('acepta el deep link de la app y una URL https', () => {
    for (const value of ['fluent://oauth/openrouter', 'https://fluent.usebot.chat/callback']) {
      expect(validateEnv({ ...baseEnv(), OPENROUTER_OAUTH_CALLBACK: value })).toMatchObject({
        OPENROUTER_OAUTH_CALLBACK: value,
      });
    }
  });
});

describe('suspiciousEnvWarnings', () => {
  it('avisa si una API que no es producción manda el callback a producción', () => {
    const warnings = suspiciousEnvWarnings({
      NODE_ENV: 'development',
      API_PUBLIC_URL: PRODUCTION_API_PUBLIC_URL,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('API_PUBLIC_URL');
  });

  it('no avisa en producción ni con una URL propia', () => {
    expect(
      suspiciousEnvWarnings({ NODE_ENV: 'production', API_PUBLIC_URL: PRODUCTION_API_PUBLIC_URL }),
    ).toEqual([]);
    expect(
      suspiciousEnvWarnings({ NODE_ENV: 'development', API_PUBLIC_URL: 'https://local.ts.net:8443' }),
    ).toEqual([]);
  });
});
