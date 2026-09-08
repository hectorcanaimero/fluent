import { ApiException } from '../common/api-error.js';
import { mapRpcErrorMessage, toRpcError } from './rpc-error.mapper.js';
import type { PostgrestErrorLike } from './insforge-result.js';

function pgError(message: string, code = 'P0001'): PostgrestErrorLike {
  return { message, code, details: null, hint: null };
}

describe('mapRpcErrorMessage', () => {
  it.each([
    ['UNAUTHENTICATED', 'UNAUTHENTICATED'],
    ['PROFILE_NOT_FOUND', 'NOT_ONBOARDED'],
    ['ALREADY_IN_GROUP', 'ALREADY_IN_GROUP'],
    ['INVITATION_INVALID', 'INVITATION_INVALID'],
    ['INVITATION_USED', 'INVITATION_USED'],
    ['INVITATION_EXPIRED', 'INVITATION_EXPIRED'],
  ] as const)('maps RPC message %s to API code %s', (message, expectedCode) => {
    expect(mapRpcErrorMessage(message)).toBe(expectedCode);
  });

  it('returns undefined for an unknown message', () => {
    expect(mapRpcErrorMessage('SOME_UNMAPPED_SQL_ERROR')).toBeUndefined();
    expect(mapRpcErrorMessage('')).toBeUndefined();
  });
});

describe('toRpcError', () => {
  it('builds an ApiException with the translated message for a known error', () => {
    const messageForCode = vi.fn().mockReturnValue('La invitación ha caducado.');

    const error = toRpcError(pgError('INVITATION_EXPIRED'), messageForCode);

    expect(error).toBeInstanceOf(ApiException);
    const apiException = error as ApiException;
    expect(apiException.code).toBe('INVITATION_EXPIRED');
    expect(apiException.getStatus()).toBe(400);
    expect(apiException.getApiBody()).toEqual({
      error: 'INVITATION_EXPIRED',
      message: 'La invitación ha caducado.',
      statusCode: 400,
    });
    expect(messageForCode).toHaveBeenCalledWith('INVITATION_EXPIRED');
  });

  it.each([
    ['ALREADY_IN_GROUP', 409],
    ['INVITATION_INVALID', 400],
    ['INVITATION_USED', 400],
  ] as const)('maps %s to HTTP %d', (message, status) => {
    const error = toRpcError(pgError(message), (code) => code);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(status);
  });

  it('maps PROFILE_NOT_FOUND to NOT_ONBOARDED (409)', () => {
    const error = toRpcError(pgError('PROFILE_NOT_FOUND'), (code) => code);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('NOT_ONBOARDED');
    expect((error as ApiException).getStatus()).toBe(409);
  });

  it('returns a plain Error (not an ApiException) for an unmapped message', () => {
    const messageForCode = vi.fn();

    const error = toRpcError(pgError('some_sql_syntax_error', '42601'), messageForCode);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiException);
    expect((error as Error).message).toContain('some_sql_syntax_error');
    expect((error as Error).message).toContain('42601');
    expect(messageForCode).not.toHaveBeenCalled();
  });
});
