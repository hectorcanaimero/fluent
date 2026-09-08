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

describe('isValidCallbackUrl', () => {
  it('accepts the deep link of the app and https URLs', () => {
    expect(isValidCallbackUrl('fluent://oauth/openrouter')).toBe(true);
    expect(isValidCallbackUrl('https://app.fluent.test/oauth/openrouter')).toBe(true);
  });

  it('rejects empty values, relative paths and values with whitespace', () => {
    expect(isValidCallbackUrl('')).toBe(false);
    expect(isValidCallbackUrl('   ')).toBe(false);
    expect(isValidCallbackUrl('/oauth/openrouter')).toBe(false);
    expect(isValidCallbackUrl('fluent://oauth/open router')).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(isValidCallbackUrl('javascript:alert(1)')).toBe(false);
    expect(isValidCallbackUrl('data:text/html,hola')).toBe(false);
    expect(isValidCallbackUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects absurdly long values', () => {
    expect(isValidCallbackUrl(`https://app.fluent.test/${'a'.repeat(3000)}`)).toBe(false);
  });
});
