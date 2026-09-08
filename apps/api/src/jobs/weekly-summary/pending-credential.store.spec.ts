import {
  PENDING_CREDENTIAL_TTL_SECONDS,
  pendingCredentialKey,
  WeeklySummaryPendingCredentialStore,
} from './pending-credential.store.js';

const OWNER_ID = '33333333-3333-4333-8333-333333333333';

function makeRedis() {
  return {
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  };
}

describe('WeeklySummaryPendingCredentialStore (SPEC-05 §4 paso 3)', () => {
  it('escribe la clave exacta con el JSON y el TTL documentados', async () => {
    const redis = makeRedis();
    const store = new WeeklySummaryPendingCredentialStore(redis as never);

    await store.markMissing(OWNER_ID, {
      groupId: 'g1',
      weekStart: '2026-09-07',
    });

    expect(redis.set).toHaveBeenCalledWith(
      pendingCredentialKey(OWNER_ID),
      JSON.stringify({ groupId: 'g1', weekStart: '2026-09-07', code: 'NO_CREDENTIAL' }),
      'EX',
      PENDING_CREDENTIAL_TTL_SECONDS,
    );
    expect(pendingCredentialKey(OWNER_ID)).toBe(
      `fluent:pending:weekly-summary-credential:${OWNER_ID}`,
    );
  });

  it('borra la clave del owner', async () => {
    const redis = makeRedis();
    const store = new WeeklySummaryPendingCredentialStore(redis as never);

    await store.clear(OWNER_ID);

    expect(redis.del).toHaveBeenCalledWith(pendingCredentialKey(OWNER_ID));
  });
});
