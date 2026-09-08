import { isValidIanaTimezone } from './iana-timezone.validator.js';

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
