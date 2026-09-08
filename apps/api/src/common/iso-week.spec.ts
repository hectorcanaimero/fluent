import { formatIsoDate, mondayOfIsoWeekUtc, resolveWeekStart } from './iso-week.js';

describe('mondayOfIsoWeekUtc', () => {
  it('a Monday maps to itself', () => {
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2026-09-07T12:00:00.000Z')))).toBe(
      '2026-09-07',
    );
  });

  it('a Sunday belongs to the week that started the Monday before, not the following one', () => {
    // 2023-01-01 is a Sunday.
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2023-01-01T00:00:00.000Z')))).toBe(
      '2022-12-26',
    );
  });

  it('a mid-week day resolves to that week\'s Monday', () => {
    // 2026-09-09 is a Wednesday.
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2026-09-09T23:59:59.000Z')))).toBe(
      '2026-09-07',
    );
  });

  it('handles a year change correctly (2023-12-31 Sunday -> 2024-01-01 Monday is a new week)', () => {
    // 2023-12-31 is a Sunday, belongs to the week that started 2023-12-25.
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2023-12-31T00:00:00.000Z')))).toBe(
      '2023-12-25',
    );
    // 2024-01-01 is a Monday: its own week start, the first week of 2024.
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2024-01-01T00:00:00.000Z')))).toBe(
      '2024-01-01',
    );
  });

  it('handles a year change where Jan 1st is itself a Sunday', () => {
    // 2023-01-01 (tested above) already covers this; add a Saturday case
    // right before another year boundary: 2022-01-01 is a Saturday.
    expect(formatIsoDate(mondayOfIsoWeekUtc(new Date('2022-01-01T00:00:00.000Z')))).toBe(
      '2021-12-27',
    );
  });
});

describe('resolveWeekStart', () => {
  const now = new Date('2026-09-09T10:00:00.000Z'); // Wednesday

  it('without a param, resolves the Monday of the current week', () => {
    expect(resolveWeekStart(undefined, now)).toBe('2026-09-07');
  });

  it('with a Monday param, resolves to itself', () => {
    expect(resolveWeekStart('2026-08-31', now)).toBe('2026-08-31');
  });

  it('with a Sunday param, resolves to the Monday before it', () => {
    expect(resolveWeekStart('2023-01-01', now)).toBe('2022-12-26');
  });

  it('resolves correctly across a year boundary', () => {
    expect(resolveWeekStart('2023-12-31', now)).toBe('2023-12-25');
    expect(resolveWeekStart('2024-01-01', now)).toBe('2024-01-01');
  });

  it('rejects a malformed date -> null', () => {
    expect(resolveWeekStart('not-a-date', now)).toBeNull();
    expect(resolveWeekStart('2026-9-7', now)).toBeNull();
    expect(resolveWeekStart('2026-09-07T00:00:00Z', now)).toBeNull();
  });

  it('rejects a calendar-invalid date -> null', () => {
    expect(resolveWeekStart('2024-02-30', now)).toBeNull();
    expect(resolveWeekStart('2026-13-01', now)).toBeNull();
  });
});
