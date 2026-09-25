import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import { AdminRepository } from '../admin/admin.repository.js';
import type { Env } from '../config/env.js';
import type { Plan } from '../db/schema.js';
import type { RevenueCatEvent, RevenueCatWebhookDto } from './dto/revenuecat-event.dto.js';

const PRO_ENTITLEMENT = 'pro';
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);

type PlanChange = { plan: Plan; expiresAt: string | null };

/**
 * `POST /webhooks/revenuecat` (F4.1.T1): traduce eventos de RevenueCat a
 * `profiles.plan`. Cada evento escribe un estado absoluto, así que repetirlo
 * deja lo mismo (idempotente).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly adminRepository: AdminRepository,
  ) {}

  async handleWebhook(
    authorization: string | undefined,
    body: RevenueCatWebhookDto,
    now: Date = new Date(),
  ): Promise<void> {
    const secret = this.config.get('REVENUECAT_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw ApiException.of('NOT_FOUND', 'Recurso no encontrado.');
    if (!sameSecret(authorization ?? '', `Bearer ${secret}`)) throw ApiException.unauthenticated();

    const event = body?.event;
    const change = event ? planChange(event, now) : null;
    if (!change || typeof event?.app_user_id !== 'string') return;

    const row = await this.adminRepository.setPlan(event.app_user_id, change.plan, change.expiresAt);
    if (row === null) {
      // 200 igualmente: un 5xx haría que RevenueCat reintentara sin fin.
      this.logger.warn(`RevenueCat ${event.type}: no hay perfil para ${event.app_user_id}`);
      return;
    }
    this.logger.log(`RevenueCat ${event.type}: ${event.app_user_id} → ${change.plan}`);
  }
}

/** Compara en tiempo constante (hash previo para igualar longitudes). */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** Plan a escribir para el evento, o `null` si no cambia nada. */
export function planChange(event: RevenueCatEvent, now: Date): PlanChange | null {
  const toFree: PlanChange = { plan: 'free', expiresAt: null };
  const isPast = (ms: number | null | undefined) => ms == null || ms <= now.getTime();

  switch (event.type) {
    case 'EXPIRATION':
      return toFree;
    case 'CANCELLATION':
      // Cancelar solo apaga la renovación: sigue Pro hasta que venza.
      return isPast(event.expiration_at_ms) ? toFree : null;
    case 'BILLING_ISSUE':
      // Sin periodo de gracia, o con la gracia ya vencida.
      return isPast(event.grace_period_expiration_at_ms) ? toFree : null;
    default:
      if (!GRANT_EVENTS.has(event.type ?? '')) return null;
      if (!event.entitlement_ids?.includes(PRO_ENTITLEMENT)) return null;
      return {
        plan: 'pro',
        expiresAt: event.expiration_at_ms == null ? null : new Date(event.expiration_at_ms).toISOString(),
      };
  }
}
