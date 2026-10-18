import { canonicalTimezone, isValidIanaTimezone } from './iana-timezone.validator.js';

describe('isValidIanaTimezone', () => {
  it.each([
    'America/Sao_Paulo',
    'America/Argentina/Buenos_Aires',
    'Europe/Madrid',
    'UTC',
    'Etc/UTC',
  ])('accepts %s', (tz) => {
    expect(isValidIanaTimezone(tz)).toBe(true);
  });

  it.each(['Not/A_Timezone', 'Mars/Phobos', '', 'GMT+25', 'america/sao_paulo '])(
    'rejects %s',
    (tz) => {
      expect(isValidIanaTimezone(tz)).toBe(false);
    },
  );

  it('rejects non-string values', () => {
    expect(isValidIanaTimezone(undefined)).toBe(false);
    expect(isValidIanaTimezone(null)).toBe(false);
    expect(isValidIanaTimezone(42)).toBe(false);
  });
});

describe('canonicalTimezone', () => {
  it('convierte los alias antiguos que Postgres no reconoce', () => {
    expect(canonicalTimezone('US/Pacific')).toBe('America/Los_Angeles');
    expect(canonicalTimezone('Brazil/East')).toBe('America/Sao_Paulo');
  });

  it('deja igual una zona canónica', () => {
    expect(canonicalTimezone('America/Sao_Paulo')).toBe('America/Sao_Paulo');
  });
});
