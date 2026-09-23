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

### F3.1.T1 — core/api sin proveedores y con plan

- `apps/mobile/lib/core/api/fluent_api.dart`: quitar `startOpenRouterPkce`,
  `completeOpenRouterPkce`, `connectGemini`, `disconnectProvider`,
  `getProviderStatus`. Mantener `getModels` y `putModelPreference`.
- `apps/mobile/lib/core/api/models.dart`: `MeResponse` pierde `providers` y la
  extensión `MeResponseProviders`; gana `plan` (`String`, `'free'` por defecto)
  y `planExpiresAt` (`DateTime?`), más una extensión `MeResponsePlan` con
  `bool get isPro` (plan `pro` y fecha nula o futura). Borrar `ProviderInfo`,
  `ProviderCredits`, `ProviderStatusResult`, `PkceStartResult`.
  `ModelsCatalog.providers` sigue siendo `Map<String, ModelTierGroups>`.
- `http_fluent_api.dart` y `fake_api.dart` acordes. El fake devuelve un usuario
  Free por defecto y expone un `setPlan('pro')` para tests y demo.
- Regenerar `models.g.dart` y `models.freezed.dart`.
- Tests en `apps/mobile/test/core/api/` adaptados: parseo de `plan` y
  `planExpiresAt`, `isPro` con fecha vencida.

Done when: `flutter analyze` sin errores en `lib/core`; `flutter test test/core`
pasa. El resto de la app puede no compilar todavía (lo arreglan F3.2 y F3.3).

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Cambio de contrato mecánico con codegen.
- **Dependencies**:
- **Files**:
  - `apps/mobile/lib/core/api/fluent_api.dart`
  - `apps/mobile/lib/core/api/http_fluent_api.dart`
  - `apps/mobile/lib/core/api/fake_api.dart`
  - `apps/mobile/lib/core/api/models.dart`
  - `apps/mobile/lib/core/api/models.g.dart`
  - `apps/mobile/lib/core/api/models.freezed.dart`
  - `apps/mobile/test/core/api/http_fluent_api_sessions_test.dart`
  - `apps/mobile/test/core/api/http_fluent_api_turn_stream_test.dart`
  - `apps/mobile/test/core/api/models_test.dart`

## F3.2 — Package: quitar proveedores

### F3.2.T1 — Borrar la pantalla y el flujo de proveedores

- Mover `apps/mobile/lib/features/providers/data/oauth_launcher.dart` a
  `apps/mobile/lib/features/auth/data/oauth_launcher.dart` (lo usa
  `social_sign_in.dart`) y actualizar imports.
- Borrar `apps/mobile/lib/features/providers/` entera y
  `apps/mobile/test/features/providers/`.
- `apps/mobile/lib/app/router.dart`: quitar la ruta `/providers`.
- `apps/mobile/lib/core/providers.dart`: quitar `ProvidersData`,
  `canPracticeProvider` y cualquier provider de Riverpod que dependa de
  `hasActiveProvider`; `HomeData` deja de mirar proveedores.
- `apps/mobile/lib/features/onboarding/presentation/onboarding_flow.dart`:
  quitar el salto a `/providers` y su comentario (MAL-24).
- `apps/mobile/lib/features/home/`: cualquier aviso o CTA de «conecta un
  proveedor» desaparece.
- Asset `assets/auth/google_g.png` y demás de auth se quedan.

Done when: `flutter analyze` limpio; `flutter test` pasa (los tests de home y
onboarding dejan de preparar proveedores); `grep -rn "providers" apps/mobile/lib --include=*.dart`
solo devuelve `core/providers.dart` (Riverpod) y `MeResponse`-nada.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Borrado guiado por el compilador.
- **Dependencies**: F3.1.T1
- **Files**:
  - `apps/mobile/lib/features/providers/data/oauth_launcher.dart`
  - `apps/mobile/lib/features/providers/domain/providers_data.dart`
  - `apps/mobile/lib/features/providers/presentation/providers_screen.dart`
  - `apps/mobile/lib/features/auth/data/oauth_launcher.dart`
  - `apps/mobile/lib/features/auth/data/social_sign_in.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/core/providers.dart`
  - `apps/mobile/lib/features/onboarding/presentation/onboarding_flow.dart`
  - `apps/mobile/lib/features/home/presentation/home_screen.dart`
  - `apps/mobile/lib/features/home/presentation/home_shell.dart`
  - `apps/mobile/test/features/providers/providers_screen_test.dart`
  - `apps/mobile/test/features/onboarding/onboarding_flow_test.dart`
  - `apps/mobile/test/features/home/home_screen_test.dart`
  - `apps/mobile/test/features/home/home_shell_test.dart`

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
- **Dependencies**: F3.1.T1, F3.2.T1
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
