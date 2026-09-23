import type { Plan, Profile } from '../db/schema.js';

type PlanFields = Pick<Profile, 'plan' | 'plan_expires_at'>;

/** `pro` sin fecha no vence; con fecha pasada o inválida cuenta como `free`. */
export function effectivePlan(profile: PlanFields, now: Date = new Date()): Plan {
  if (profile.plan !== 'pro') return 'free';
  if (profile.plan_expires_at === null) return 'pro';
  const expires = Date.parse(profile.plan_expires_at);
  return expires > now.getTime() ? 'pro' : 'free'; // NaN → free
}

export function isPro(profile: PlanFields, now: Date = new Date()): boolean {
  return effectivePlan(profile, now) === 'pro';
}
