import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import type { AdminRepository } from '../admin/admin.repository.js';
import { BillingService } from './billing.service.js';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto.js';

const SECRET = 'rc_test_secret';
const AUTH = `Bearer ${SECRET}`;
const USER = 'user-1';
const NOW = new Date('2026-09-23T12:00:00.000Z');
const FUTURE_MS = Date.parse('2026-10-23T12:00:00.000Z');
const PAST_MS = Date.parse('2026-09-01T12:00:00.000Z');

type Row = { user_id: string; plan: 'free' | 'pro'; plan_expires_at: string | null };

/** Repositorio en memoria: solo `USER` tiene perfil. */
function setup(secret = SECRET) {
  const profiles = new Map<string, Row>([[USER, { user_id: USER, plan: 'free', plan_expires_at: null }]]);
  const setPlan = vi.fn(async (userId: string, plan: Row['plan'], expiresAt: string | null) => {
    if (!profiles.has(userId)) return null;
    const row = { user_id: userId, plan, plan_expires_at: expiresAt };
    profiles.set(userId, row);
    return row;
  });
  const config = { get: () => secret } as unknown as ConfigService<never, true>;
  const service = new BillingService(config as never, { setPlan } as unknown as AdminRepository);
  const send = (event: RevenueCatEvent, auth: string | undefined = AUTH) =>
    service.handleWebhook(auth, { event: { app_user_id: USER, ...event } }, NOW);
  return { service, profiles, setPlan, send, state: () => profiles.get(USER) };
}

const makePro = (s: ReturnType<typeof setup>) =>
  s.profiles.set(USER, { user_id: USER, plan: 'pro', plan_expires_at: new Date(FUTURE_MS).toISOString() });

describe('BillingService.handleWebhook', () => {
  describe('secreto', () => {
    it('sin REVENUECAT_WEBHOOK_SECRET responde 404 aunque el bearer coincida', async () => {
      const s = setup('');
      await expect(s.send({ type: 'INITIAL_PURCHASE' }, 'Bearer undefined')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(s.setPlan).not.toHaveBeenCalled();
    });

    it.each(['', SECRET, 'Bearer otro', `Basic ${SECRET}`, `${AUTH}x`])(
      'secreto incorrecto (%s) → 401 UNAUTHENTICATED sin tocar perfiles',
      async (auth) => {
        const s = setup();
        const error = await s
          .send({ type: 'INITIAL_PURCHASE', entitlement_ids: ['pro'] }, auth)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiException);
        expect((error as ApiException).code).toBe('UNAUTHENTICATED');
        expect(s.setPlan).not.toHaveBeenCalled();
      },
    );
  });

  describe('eventos que dan Pro', () => {
    it.each(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'])(
      '%s con entitlement pro → plan pro con la expiración del evento',
      async (type) => {
        const s = setup();
        await s.send({ type, entitlement_ids: ['pro'], expiration_at_ms: FUTURE_MS });
        expect(s.state()).toMatchObject({ plan: 'pro', plan_expires_at: '2026-10-23T12:00:00.000Z' });
      },
    );

    it('sin expiration_at_ms (vitalicio) → pro sin fecha', async () => {
      const s = setup();
      await s.send({ type: 'INITIAL_PURCHASE', entitlement_ids: ['pro'], expiration_at_ms: null });
      expect(s.state()).toMatchObject({ plan: 'pro', plan_expires_at: null });
    });

    it.each([[['otro']], [[]], [null], [undefined]])('sin entitlement pro (%j) → sin cambios', async (ids) => {
      const s = setup();
      await s.send({ type: 'INITIAL_PURCHASE', entitlement_ids: ids, expiration_at_ms: FUTURE_MS });
      expect(s.setPlan).not.toHaveBeenCalled();
    });
  });

  describe('eventos que quitan Pro', () => {
    it('EXPIRATION → free sin fecha', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'EXPIRATION', expiration_at_ms: PAST_MS });
      expect(s.state()).toMatchObject({ plan: 'free', plan_expires_at: null });
    });

    it('CANCELLATION con expiración pasada → free', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'CANCELLATION', expiration_at_ms: PAST_MS });
      expect(s.state()).toMatchObject({ plan: 'free', plan_expires_at: null });
    });

    it('CANCELLATION con expiración futura → sigue Pro hasta que venza', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'CANCELLATION', expiration_at_ms: FUTURE_MS });
      expect(s.setPlan).not.toHaveBeenCalled();
      expect(s.state()?.plan).toBe('pro');
    });

    it('BILLING_ISSUE con la gracia vencida → free', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: PAST_MS });
      expect(s.state()).toMatchObject({ plan: 'free', plan_expires_at: null });
    });

    it('BILLING_ISSUE sin periodo de gracia → free', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: null });
      expect(s.state()?.plan).toBe('free');
    });

    it('BILLING_ISSUE dentro de la gracia → sin cambios', async () => {
      const s = setup();
      makePro(s);
      await s.send({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: FUTURE_MS });
      expect(s.setPlan).not.toHaveBeenCalled();
    });
  });

  it.each(['TEST', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_PAUSED', 'TRANSFER', undefined])(
    'otro evento (%s) → 200 sin cambios',
    async (type) => {
      const s = setup();
      await expect(s.send({ type, entitlement_ids: ['pro'] })).resolves.toBeUndefined();
      expect(s.setPlan).not.toHaveBeenCalled();
    },
  );

  it('cuerpo sin event → 200 sin cambios', async () => {
    const s = setup();
    await expect(s.service.handleWebhook(AUTH, {}, NOW)).resolves.toBeUndefined();
    expect(s.setPlan).not.toHaveBeenCalled();
  });

  it('idempotente: el mismo evento dos veces deja el mismo estado', async () => {
    const s = setup();
    const event = { type: 'INITIAL_PURCHASE', entitlement_ids: ['pro'], expiration_at_ms: FUTURE_MS };
    await s.send(event);
    const first = { ...s.state() };
    await s.send(event);
    expect(s.state()).toEqual(first);

    await s.send({ type: 'EXPIRATION' });
    await s.send({ type: 'EXPIRATION' });
    expect(s.state()).toMatchObject({ plan: 'free', plan_expires_at: null });
  });

  it('app_user_id sin perfil → resuelve (200) y avisa con warn', async () => {
    const s = setup();
    const warn = vi.spyOn((s.service as unknown as { logger: { warn: () => void } }).logger, 'warn');
    await expect(
      s.service.handleWebhook(
        AUTH,
        { event: { type: 'INITIAL_PURCHASE', app_user_id: 'ghost', entitlement_ids: ['pro'] } },
        NOW,
      ),
    ).resolves.toBeUndefined();
    expect(s.setPlan).toHaveBeenCalledWith('ghost', 'pro', null);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ghost'));
  });
});
