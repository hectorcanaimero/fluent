---
type: spec
project_id: fluent
phase: 3
version: 0.1
depends_on:
  - docs/arch/001-9router-y-planes.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-09-23
title: App móvil sin proveedores, con plan
---

# F3 — App móvil sin proveedores, con plan

La app deja de pedir keys. Desaparece la pantalla de proveedores y el flujo
PKCE; aparece una pantalla de plan en ajustes y el selector de modelo queda
solo para Pro. El login social (Google y Apple) ya existe y no se toca.
Arquitectura: `docs/arch/001-9router-y-planes.md`, sección *Mobile*.

Contexto del repo: `apps/mobile` es Flutter con Riverpod, go_router, dio y
freezed. Tests con `flutter test`. Modelos generados con
`dart run build_runner build --delete-conflicting-outputs`. Textos en
`lib/l10n/app_es.arb` y `app_pt.arb`, generados en `lib/l10n/gen/` con
`flutter gen-l10n`. Contrato HTTP: `docs/specs/SPEC-02-auth-y-api.md` §4 tal
como lo deja F2.3.

## F3.1 — Package: contrato de API

### F3.1.T1 — core/api sin proveedores, con plan, y borrado de la pantalla de proveedores

El job `mobile` del CI corre `flutter analyze` y `flutter test` sobre toda la
app, así que el cambio de contrato y el borrado de quien lo usaba tienen que
ir en el mismo PR. Esta tarea hace las dos cosas.

Parte del trabajo ya está en `main` (PR 41 y PR 46): `fluent_api.dart`,
`http_fluent_api.dart`, `fake_api.dart` y `models.dart` ya no tienen
proveedores y `MeResponse` ya tiene `plan`, `planExpiresAt` e `isPro`;
`models.g.dart` y `models.freezed.dart` pueden estar regenerados o no.
Empezar por `flutter analyze` y arreglar todo lo que salga.

**Contrato (`lib/core/api`)**
- `fluent_api.dart` sin `startOpenRouterPkce`, `completeOpenRouterPkce`,
  `connectGemini`, `disconnectProvider`, `getProviderStatus`. Se mantienen
  `getModels` y `putModelPreference`.
- `models.dart`: `MeResponse` sin `providers` ni `MeResponseProviders`; con
  `plan` (`String`, `'free'` por defecto), `planExpiresAt` (`DateTime?`) y la
  extensión `MeResponsePlan` con `bool get isPro`. Sin `ProviderInfo`,
  `ProviderCredits`, `ProviderStatusResult`, `PkceStartResult`.
- `fake_api.dart` devuelve un usuario Free y expone `setPlan('pro')`.
- Regenerar con `dart run build_runner build --delete-conflicting-outputs`.

**Borrado (lo que antes era F3.2)**
- Mover `lib/features/providers/data/oauth_launcher.dart` a
  `lib/features/auth/data/oauth_launcher.dart` (lo usa `social_sign_in.dart`)
  y actualizar imports.
- Borrar `lib/features/providers/` entera y `test/features/providers/`.
- `lib/app/router.dart`: quitar la ruta `/providers`.
- `lib/core/providers.dart`: quitar `ProvidersData`, `canPracticeProvider` y
  todo provider de Riverpod que dependa de `hasActiveProvider`; `HomeData`
  deja de mirar proveedores.
- `lib/features/onboarding/presentation/onboarding_flow.dart`: quitar el
  salto a `/providers` (MAL-24).
- `lib/features/home/`: quitar cualquier aviso o CTA de «conecta un proveedor».
- `lib/features/settings/presentation/settings_screen.dart`: la entrada
  «Proveedores» se quita; la pantalla de plan la añade F3.3.
- Tests de home, onboarding y `core/api` adaptados: ya no preparan
  proveedores; `models_test.dart` cubre `plan`, `planExpiresAt` e `isPro`
  con fecha vencida.

Done when: `flutter analyze` sin errores ni warnings nuevos y `flutter test`
completo en verde, los dos ejecutados en `apps/mobile` antes de terminar.
`grep -rn "ProviderInfo\|PkceStart\|/providers" apps/mobile/lib` no
devuelve nada.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: Cambio de contrato más borrado guiado por el compilador; sin lógica nueva.
- **Dependencies**:
- **Files**:
  - `apps/mobile/lib/core/api/fluent_api.dart`
  - `apps/mobile/lib/core/api/http_fluent_api.dart`
  - `apps/mobile/lib/core/api/fake_api.dart`
  - `apps/mobile/lib/core/api/models.dart`
  - `apps/mobile/lib/core/api/models.g.dart`
  - `apps/mobile/lib/core/api/models.freezed.dart`
  - `apps/mobile/lib/core/providers.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/features/providers/data/oauth_launcher.dart`
  - `apps/mobile/lib/features/providers/domain/providers_data.dart`
  - `apps/mobile/lib/features/providers/presentation/providers_screen.dart`
  - `apps/mobile/lib/features/auth/data/oauth_launcher.dart`
  - `apps/mobile/lib/features/auth/data/social_sign_in.dart`
  - `apps/mobile/lib/features/onboarding/presentation/onboarding_flow.dart`
  - `apps/mobile/lib/features/home/presentation/home_screen.dart`
  - `apps/mobile/lib/features/home/presentation/home_shell.dart`
  - `apps/mobile/lib/features/settings/presentation/settings_screen.dart`
  - `apps/mobile/test/core/api/http_fluent_api_sessions_test.dart`
  - `apps/mobile/test/core/api/http_fluent_api_turn_stream_test.dart`
  - `apps/mobile/test/core/api/models_test.dart`
  - `apps/mobile/test/features/providers/providers_screen_test.dart`
  - `apps/mobile/test/features/onboarding/onboarding_flow_test.dart`
  - `apps/mobile/test/features/home/home_screen_test.dart`
  - `apps/mobile/test/features/home/home_shell_test.dart`
  - `apps/mobile/test/features/settings/settings_screen_test.dart`

## F3.2 — Package: quitar proveedores

### F3.2.T1 — Absorbida por F3.1.T1

Sin trabajo. El job `mobile` del CI analiza toda la app, así que el borrado
de la pantalla de proveedores no puede ir en un PR separado del cambio de
contrato: todo está en F3.1.T1. Se conserva el id para no romper las
dependencias de F3.3 y F5.1. Marcar hecha con nota cuando F3.1.T1 esté en
`main`.

- **Model**: claude/claude-haiku-4-5-20251001
- **Estimate**: 15m
- **Reason**: No hay nada que ejecutar.
- **Dependencies**: F3.1.T1
- **Files**:

## F3.3 — Package: pantalla de plan

### F3.3.T1 — Pantalla de plan, selector solo Pro y textos

- Nueva `apps/mobile/lib/features/settings/presentation/plan_screen.dart` en
  la ruta `/settings/plan`: muestra el plan actual (`Free` o `Pro` con fecha de
  vencimiento si la hay), una lista de lo que incluye Pro (modelos de pago a
  elegir, tope diario de 120 turnos, brief con modelo fuerte) y un botón
  «Pasar a Pro» que en esta fase abre un diálogo «Disponible pronto». Para Pro
  el botón no aparece. Seguir el estilo de `settings_screen.dart` y los
  tokens de `AppColors`.
- `apps/mobile/lib/features/settings/presentation/settings_screen.dart`: la
  entrada «Proveedores» (`l10n.providersTitle`) se sustituye por «Plan» que
  navega a `/settings/plan`. El selector de modelo (donde esté hoy: si vivía
  en `providers_screen.dart`, recrearlo como `model_picker_screen.dart` en
  `features/settings/presentation/`) solo se muestra si `me.isPro`; para Free
  se muestra el texto «Modelos gratuitos con respaldo automático».
- `apps/mobile/lib/core/errors/l10n_for_api_error.dart`: quitar
  `PROVIDER_NOT_CONNECTED` y `PROVIDER_KEY_INVALID`; añadir `PLAN_REQUIRED`
  («Elegir un modelo de pago requiere el plan Pro.» / portugués equivalente).
- `app_es.arb` y `app_pt.arb`: borrar las claves de proveedores que ya no se
  usan (comprobar con `grep` en `lib/`), añadir las de plan. Regenerar
  `lib/l10n/gen/`.
- Registrar la ruta en `router.dart` (solo la línea nueva; F3.2 quita la vieja
  y ambas tareas dependen de F3.1, así que ejecutar esta después de F3.2 si
  hay conflicto en `router.dart`: la dependencia lo garantiza).

Done when: `flutter analyze` limpio; `flutter test` pasa incluyendo un
`plan_screen_test.dart` que cubre Free con botón, Pro sin botón y Pro vencido
como Free; ningún `l10n.providers*` queda referenciado.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: UI nueva sencilla más l10n; sin lógica de negocio.
- **Dependencies**: F3.1.T1
- **Files**:
  - `apps/mobile/lib/features/settings/presentation/plan_screen.dart`
  - `apps/mobile/lib/features/settings/presentation/model_picker_screen.dart`
  - `apps/mobile/lib/features/settings/presentation/settings_screen.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/core/errors/l10n_for_api_error.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/lib/l10n/gen/app_localizations.dart`
  - `apps/mobile/lib/l10n/gen/app_localizations_es.dart`
  - `apps/mobile/lib/l10n/gen/app_localizations_pt.dart`
  - `apps/mobile/test/features/settings/plan_screen_test.dart`
  - `apps/mobile/test/features/settings/settings_screen_test.dart`
