import { requireRow, unwrapInsforge } from './insforge-result.js';

describe('unwrapInsforge', () => {
  it('returns data when there is no error', () => {
    expect(unwrapInsforge({ data: { id: '1' }, error: null })).toEqual({ id: '1' });
  });

  it('returns null when data is null and there is no error (e.g. maybeSingle miss)', () => {
    expect(unwrapInsforge({ data: null, error: null })).toBeNull();
  });

  it('throws a plain Error (not ApiException) when there is an error', () => {
    expect(() =>
      unwrapInsforge({
        data: null,
        error: { code: '42601', message: 'syntax error', details: null, hint: null },
      }),
    ).toThrowError(/syntax error/);
  });

  it('includes the Postgres error code in the thrown message', () => {
    try {
      unwrapInsforge({
        data: null,
        error: { code: '23505', message: 'duplicate key', details: null, hint: null },
      });
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect((error as Error).message).toContain('23505');
      expect((error as Error).message).toContain('duplicate key');
    }
  });
});

describe('requireRow', () => {
  it('returns the row when it is not null', () => {
    expect(requireRow({ id: '1' }, 'ctx')).toEqual({ id: '1' });
  });

  it('throws when the row is null', () => {
    expect(() => requireRow(null, 'updateProfile')).toThrowError(/updateProfile/);
  });
});
