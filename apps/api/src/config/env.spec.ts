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

describe('INTERVIEW_*', () => {
  it('un valor vacío cae al default', () => {
    const env = validateEnv({
      ...baseEnv(),
      INTERVIEWS_REQUIRE_PRO: '',
      INTERVIEW_MAX_SEC: '',
      INTERVIEW_WARN_SEC: ' ',
      INTERVIEWS_DAILY_CAP: '',
      INTERVIEW_ABANDON_AFTER_SEC: '',
      INTERVIEW_AGENT_URL: '',
      INTERVIEW_AGENT_TOKEN: '',
    });
    expect(env.INTERVIEWS_REQUIRE_PRO).toBe(false);
    expect(env.INTERVIEW_MAX_SEC).toBe(600);
    expect(env.INTERVIEW_WARN_SEC).toBe(540);
    expect(env.INTERVIEWS_DAILY_CAP).toBe(3);
    expect(env.INTERVIEW_ABANDON_AFTER_SEC).toBe(86400);
    expect(env.INTERVIEW_AGENT_URL).toBeUndefined();
  });

  it('tumba el arranque si INTERVIEW_WARN_SEC >= INTERVIEW_MAX_SEC', () => {
    expect(() =>
      validateEnv({ ...baseEnv(), INTERVIEW_MAX_SEC: '300' }),
    ).toThrow(/INTERVIEW_WARN_SEC/);
  });

  it('exige INTERVIEW_AGENT_URL e INTERVIEW_AGENT_TOKEN juntas', () => {
    const url = 'http://interview-agent:8000';
    expect(() =>
      validateEnv({ ...baseEnv(), INTERVIEW_AGENT_URL: url }),
    ).toThrow(/van juntas/);
    expect(() =>
      validateEnv({ ...baseEnv(), INTERVIEW_AGENT_TOKEN: 't' }),
    ).toThrow(/van juntas/);
    expect(
      validateEnv({
        ...baseEnv(),
        INTERVIEW_AGENT_URL: url,
        INTERVIEW_AGENT_TOKEN: 't',
      }).INTERVIEW_AGENT_URL,
    ).toBe(url);
  });

  it('una INTERVIEW_AGENT_URL mal formada da un error explícito', () => {
    expect(() =>
      validateEnv({
        ...baseEnv(),
        INTERVIEW_AGENT_URL: 'nope',
        INTERVIEW_AGENT_TOKEN: 't',
      }),
    ).toThrow(/INTERVIEW_AGENT_URL no es una URL válida/);
  });
});
