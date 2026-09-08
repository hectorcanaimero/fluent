import { randomBytes } from 'node:crypto';
import { validateEnv } from './env.js';

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
