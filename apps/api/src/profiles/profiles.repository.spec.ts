import { clampDisplayName, localPartOfEmail } from './profiles.repository.js';

describe('clampDisplayName', () => {
  it('trims surrounding whitespace', () => {
    expect(clampDisplayName('  Ana  ')).toBe('Ana');
  });

  it('truncates to 30 characters', () => {
    const long = 'A'.repeat(40);
    const result = clampDisplayName(long);
    expect(result).toHaveLength(30);
    expect(result).toBe('A'.repeat(30));
  });

  it('falls back to "Usuario" when shorter than 2 characters after trimming', () => {
    expect(clampDisplayName('A')).toBe('Usuario');
    expect(clampDisplayName('  ')).toBe('Usuario');
    expect(clampDisplayName('')).toBe('Usuario');
    expect(clampDisplayName(null)).toBe('Usuario');
    expect(clampDisplayName(undefined)).toBe('Usuario');
  });

  it('keeps a 2-character name as is', () => {
    expect(clampDisplayName('Bo')).toBe('Bo');
  });
});

describe('localPartOfEmail', () => {
  it('returns the part before the @', () => {
    expect(localPartOfEmail('ana.gomez@example.com')).toBe('ana.gomez');
  });

  it('returns null for null/undefined/empty input', () => {
    expect(localPartOfEmail(null)).toBeNull();
    expect(localPartOfEmail(undefined)).toBeNull();
    expect(localPartOfEmail('')).toBeNull();
  });

  it('returns null when there is no local part (e.g. "@example.com")', () => {
    expect(localPartOfEmail('@example.com')).toBeNull();
  });
});
