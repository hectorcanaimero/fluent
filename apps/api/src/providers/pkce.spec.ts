import { createHash } from 'node:crypto';
import {
  buildOpenRouterAuthUrl,
  codeChallengeS256,
  generateCodeVerifier,
  isValidCallbackUrl,
  OPENROUTER_AUTH_URL,
} from './pkce.js';

describe('generateCodeVerifier (RFC 7636)', () => {
  it('produces 43 characters of the unreserved alphabet (base64url)', () => {
    for (let i = 0; i < 50; i += 1) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9\-_]{43}$/);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    }
  });

  it('never repeats', () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });
});

describe('codeChallengeS256', () => {
  it('is base64url(sha256(verifier))', () => {
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url');

    expect(codeChallengeS256(verifier)).toBe(expected);
    expect(codeChallengeS256(verifier)).toMatch(/^[A-Za-z0-9\-_]{43}$/);
  });
});

describe('buildOpenRouterAuthUrl', () => {
  it('builds the URL of SPEC-02 §4.2 with the parameters URL-encoded', () => {
    const url = new URL(buildOpenRouterAuthUrl('fluent://oauth/openrouter', 'CHALLENGE-123'));

    expect(`${url.origin}${url.pathname}`).toBe(OPENROUTER_AUTH_URL);
    expect(url.searchParams.get('callback_url')).toBe('fluent://oauth/openrouter');
    expect(url.searchParams.get('code_challenge')).toBe('CHALLENGE-123');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('escapes a callback with query string and special characters', () => {
    const callback = 'https://app.fluent.test/oauth?next=/models&x=a b';
    const raw = buildOpenRouterAuthUrl(callback, 'c');

    expect(raw).not.toContain(' ');
    expect(new URL(raw).searchParams.get('callback_url')).toBe(callback);
  });
});

describe('isValidCallbackUrl · lista blanca (MAL-18)', () => {
  /** El valor de `OPENROUTER_OAUTH_CALLBACK` en estos tests. */
  const CONFIGURED = 'https://fluent.usebot.chat/v1/providers/openrouter/callback';

  it('accepts any deep link of the app', () => {
    expect(isValidCallbackUrl('fluent://oauth/openrouter', CONFIGURED)).toBe(true);
    expect(isValidCallbackUrl('fluent://oauth/openrouter?x=1', CONFIGURED)).toBe(true);
  });

  it('accepts the configured callback, normalised', () => {
    expect(isValidCallbackUrl(CONFIGURED, CONFIGURED)).toBe(true);
    expect(isValidCallbackUrl(`  ${CONFIGURED}  `, CONFIGURED)).toBe(true);
  });

  it('rejects any other https URL: era una redirección abierta', () => {
    expect(isValidCallbackUrl('https://app.fluent.test/oauth/openrouter', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('https://evil.test/steal', CONFIGURED)).toBe(false);
    // Un host que solo *empieza* igual tampoco vale.
    expect(isValidCallbackUrl('https://fluent.usebot.chat.evil.test/v1', CONFIGURED)).toBe(false);
    // Ni otra ruta del mismo host.
    expect(isValidCallbackUrl('https://fluent.usebot.chat/otra', CONFIGURED)).toBe(false);
  });

  it('rejects empty values, relative paths and values with whitespace', () => {
    expect(isValidCallbackUrl('', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('   ', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('/oauth/openrouter', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('fluent://oauth/open router', CONFIGURED)).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(isValidCallbackUrl('javascript:alert(1)', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('data:text/html,hola', CONFIGURED)).toBe(false);
    expect(isValidCallbackUrl('file:///etc/passwd', CONFIGURED)).toBe(false);
  });

  it('rejects absurdly long values', () => {
    expect(isValidCallbackUrl(`https://app.fluent.test/${'a'.repeat(3000)}`, CONFIGURED)).toBe(false);
  });

  it('rejects everything if the configured callback is itself invalid', () => {
    expect(isValidCallbackUrl('https://app.fluent.test/x', 'no-es-una-url')).toBe(false);
    // …salvo el deep link de la app, que no depende de la configuración.
    expect(isValidCallbackUrl('fluent://oauth/openrouter', 'no-es-una-url')).toBe(true);
  });
});
