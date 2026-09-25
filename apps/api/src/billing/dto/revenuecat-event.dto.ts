/**
 * Cuerpo del webhook de RevenueCat (solo los campos que usamos).
 *
 * Es una `interface` y no una clase a propósito: el `ValidationPipe` global
 * (`forbidNonWhitelisted`) rechazaría con 400 los muchos campos que
 * RevenueCat manda y aquí no se declaran, y un 4xx haría que reintentara
 * para siempre. `BillingService` tolera cualquier forma.
 */
export interface RevenueCatWebhookDto {
  event?: RevenueCatEvent;
}

export interface RevenueCatEvent {
  type?: string;
  /** `userId` de InsForge (la app lo fija con `Purchases.logIn`, F4.2). */
  app_user_id?: string;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
}
