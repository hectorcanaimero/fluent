---
type: spec
project_id: fluent
phase: 4
version: 0.1
depends_on:
  - docs/arch/001-9router-y-planes.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-09-23
title: Cobro del plan Pro
---

# F4 — Cobro del plan Pro

Suscripción por Apple IAP y Google Play Billing a través de RevenueCat. El
webhook en la API es el único escritor del plan además del owner. Esta fase
puede esperar a que haya usuarios Free activos y un precio decidido; nada de
F5 depende de ella. Arquitectura: `docs/arch/001-9router-y-planes.md`,
sección *Billing*.

Prerrequisito del operador (sin código): proyecto en RevenueCat con las apps
iOS y Android, un producto de suscripción mensual, un *entitlement* `pro`, y
el webhook apuntando a `{API_PUBLIC_URL}/v1/webhooks/revenuecat` con el
secreto que se pondrá en `REVENUECAT_WEBHOOK_SECRET`.

## F4.1 — Package: webhook

### F4.1.T1 — POST /webhooks/revenuecat escribe el plan

- Nuevo módulo `apps/api/src/billing/` con `billing.module.ts`,
  `billing.controller.ts`, `billing.service.ts`, `billing.service.spec.ts`.
- `POST /webhooks/revenuecat`, marcado `@Public()`, exige
  `Authorization: Bearer ${REVENUECAT_WEBHOOK_SECRET}`; si no coincide,
  `401 UNAUTHENTICATED` sin detalle. `REVENUECAT_WEBHOOK_SECRET` opcional en
  `env.ts`: si falta, el endpoint responde `404` (cobro desactivado).
- Cuerpo según el formato de webhook de RevenueCat (`event.type`,
  `event.app_user_id`, `event.expiration_at_ms`, `event.entitlement_ids`).
  `app_user_id` es el `userId` de InsForge (la app lo fija en F4.2).
  Eventos `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`
  con entitlement `pro` → `plan = 'pro'`, `plan_expires_at = expiration_at_ms`.
  `EXPIRATION`, `CANCELLATION` con expiración pasada, `BILLING_ISSUE` tras
  gracia → `plan = 'free'`, `plan_expires_at = null`. Otros eventos → `200`
  sin cambios. Idempotente: el mismo evento dos veces deja el mismo estado.
- Reutilizar el repositorio de F2.3 (`admin.repository.ts` o uno propio en
  `billing/`) para escribir `profiles`. Un `app_user_id` sin perfil → `200`
  con log `warn`, nunca 5xx (RevenueCat reintenta).
- Registrar en `app.module.ts`.

Done when: `billing.service.spec.ts` cubre cada tipo de evento, idempotencia,
secreto incorrecto y perfil inexistente; `test/billing.e2e-spec.ts` cubre 401
y un `INITIAL_PURCHASE` que deja al usuario Pro en `GET /me`.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 4h
- **Reason**: Ruta pública que escribe dinero en estado; hay que acertar con la verificación y la idempotencia.
- **Dependencies**: F2.3.T1
- **Files**:
  - `apps/api/src/billing/billing.module.ts`
  - `apps/api/src/billing/billing.controller.ts`
  - `apps/api/src/billing/billing.service.ts`
  - `apps/api/src/billing/billing.service.spec.ts`
  - `apps/api/src/billing/billing.repository.ts`
  - `apps/api/src/billing/dto/revenuecat-event.dto.ts`
  - `apps/api/src/app.module.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/.env.example`
  - `apps/api/test/billing.e2e-spec.ts`

## F4.2 — Package: compra en la app

### F4.2.T1 — Suscripción con purchases_flutter

- Añadir `purchases_flutter` a `apps/mobile/pubspec.yaml`.
- `apps/mobile/lib/core/billing/billing_service.dart`: configura RevenueCat
  con la key pública por plataforma (desde `core/env.dart`), llama a
  `Purchases.logIn(userId)` tras el login para que `app_user_id` sea el id de
  InsForge, expone `Future<void> buyPro()` (abre la hoja de compra nativa del
  paquete `pro`) y `Future<void> restore()`.
- `plan_screen.dart`: el botón «Pasar a Pro» llama a `buyPro()`, muestra el
  precio localizado que devuelve RevenueCat, y tras la compra vuelve a pedir
  `GET /me` hasta que `plan == 'pro'` (máximo 10 s, luego mensaje «Se activará
  en unos minutos»). Botón secundario «Restaurar compras».
- Sin claves de RevenueCat en el entorno (`Env.revenuecatKey` vacío) la
  pantalla se comporta como en F3 (diálogo «Disponible pronto»), así el fake y
  los tests no dependen del SDK.

Done when: `flutter analyze` limpio; `plan_screen_test.dart` cubre el modo sin
clave y el modo con un `BillingService` falso que resuelve `buyPro()`;
`flutter build apk --debug` compila con la dependencia nueva.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Integración de SDK con patrón documentado por el proveedor.
- **Dependencies**: F3.3.T1, F4.1.T1
- **Files**:
  - `apps/mobile/pubspec.yaml`
  - `apps/mobile/pubspec.lock`
  - `apps/mobile/lib/core/env.dart`
  - `apps/mobile/lib/core/billing/billing_service.dart`
  - `apps/mobile/lib/core/providers.dart`
  - `apps/mobile/lib/features/settings/presentation/plan_screen.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/lib/l10n/gen/app_localizations.dart`
  - `apps/mobile/lib/l10n/gen/app_localizations_es.dart`
  - `apps/mobile/lib/l10n/gen/app_localizations_pt.dart`
  - `apps/mobile/test/features/settings/plan_screen_test.dart`
