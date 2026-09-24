---
type: arch
project_id: fluent
version: 0.1
depends_on:
  - docs/prd/001-9router-y-planes.md
generated_by: orch-arch
generated_at: 2026-09-23
title: IA vía 9router y planes — architecture
---

# IA vía 9router y planes — architecture

## Context

Monorepo pnpm: `apps/api` (NestJS 12, ESM, Node 24, InsForge como BaaS, Redis,
BullMQ, vitest) y `apps/mobile` (Flutter, Riverpod, go_router, dio, freezed).
Hoy el LLM entra por `apps/api/src/llm/llm.client.ts`, un cliente HTTP a mano
compatible con OpenAI con parser SSE propio, y `llm.service.ts` recorre la
cadena de candidatos que `model-resolver.ts` construye a partir de las
credenciales cifradas del usuario (`credentials/`, `providers/`). Las sesiones
(`sessions/sessions.service.ts`, `sessions/turns.service.ts`) y los jobs
(`jobs/coaching-brief`, `jobs/weekly-summary`) exigen una credencial activa o
la de cortesía del owner del grupo.

El PRD reemplaza todo eso por un único proveedor (9router del operador),
cambia el cliente por el Vercel AI SDK y añade un plan por perfil.

## Components

### LLM provider (`apps/api/src/llm/ninerouter.provider.ts`)

Un `createOpenAICompatible({ name: '9router', baseURL, apiKey, includeUsage: true })`
construido desde `ConfigService`. Exportado por `LlmInfraModule` bajo el token
`NINEROUTER_PROVIDER`. Lo usan API y worker. No se activa
`supportsStructuredOutputs`.

### LlmService (`apps/api/src/llm/llm.service.ts`)

Misma responsabilidad de hoy: elegir candidatos, intentar, registrar en
`llm_calls`, degradar. Cambia la implementación de cada intento:
`streamObject` cuando hay `onToken`, `generateObject` si no. Mantiene
`LlmServiceRequest`/`LlmServiceResult` salvo que `credentials` se sustituye por
`plan`. `mapError` traduce `APICallError`/`NoObjectGeneratedError`/abort a
`LlmCallStatus`. Deltas de `reply` = diferencia entre partials consecutivos.

### ModelResolver (`apps/api/src/llm/model-resolver.ts`)

Entrada: `{ plan, preference }`. Salida ordenada:
- Free: `[fluent-free]`.
- Pro: `[preference?, fluent-pro, fluent-free]` sin duplicados.
`preferenceDropped = plan === 'free' && preference != null`.

### Operator credential (`apps/api/src/credentials/credentials.service.ts`)

Fase de transición (F1): `listActive()` devuelve siempre
`[{ provider: '9router', apiKey: env.NINEROUTER_API_KEY }]`. Con eso
`PROVIDER_NOT_CONNECTED` deja de poder ocurrir sin tocar sesiones ni jobs. En F5
se borra el módulo entero y los llamadores dejan de pedir credenciales.

### Catalog (`apps/api/src/llm/catalog.service.ts`, `llm/ninerouter-models.ts`)

`GET {NINEROUTER_URL}/v1/models` cacheado 6 h en Redis (clave
`llm:catalog:9router`) cruzado con `NINEROUTER_MODELS`, lista fija
`{ id, name, tier, pricePerMillionIn, pricePerMillionOut }`. Solo se exponen los
ids presentes en ambos. `fluent-free` va en tier `free`; `fluent-pro` en
`premium`.

### Plans (`apps/api/src/profiles`, `apps/api/src/admin`, `apps/api/src/sessions/turns.service.ts`)

- `profiles.plan`, `profiles.plan_expires_at` en la base.
- `isPro(profile, now)` en `profiles/plan.ts` (función pura).
- `GET /me` expone `plan`, `planExpiresAt`; `PUT /admin/users/:id/plan` lo fija.
- `requireDailyTurnsBudget` lee `TURNS_DAILY_CAP_FREE` o `_PRO` según `isPro`.
- `ModelsService.updatePreferences` lanza `PLAN_REQUIRED` si Free elige un modelo
  con tier ≠ `free`.

### Mobile (`apps/mobile/lib`)

- `core/api`: sin métodos de proveedores; `MeResponse.plan`, `planExpiresAt`.
- `features/settings/presentation/plan_screen.dart`: estado del plan, qué
  incluye Pro, botón que en F3 muestra «pronto» y en F4 abre la compra.
- Selector de modelo (`features/settings`) visible solo si `isPro`.
- `features/auth/data/oauth_launcher.dart` (movido desde `features/providers`).

### Billing (F4, `apps/api/src/billing`, `apps/mobile` con `purchases_flutter`)

Webhook `POST /webhooks/revenuecat` con secreto compartido en cabecera; único
escritor de `plan` fuera del admin.

## Data model

Migración `apps/api/migrations/20260923120000_9router.sql` (F1):
- `model_preferences.chat_provider` y `brief_provider`: CHECK pasa a
  `IN ('9router')`, DEFAULT `'9router'`. Filas existentes: `UPDATE` a
  `'9router'` con `chat_model = 'fluent-free'`, `brief_model = 'fluent-free'`.
- `provider_credentials`: `DELETE` de todas las filas (la tabla se elimina en F5).

Migración `apps/api/migrations/20260923130000_planes.sql` (F2):
- `profiles.plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro'))`.
- `profiles.plan_expires_at timestamptz NULL`.
- RLS: `authenticated` puede leer las dos columnas de su fila; solo la API
  (clave admin) escribe.

Migración `apps/api/migrations/20260923140000_borrar-byok.sql` (F5):
- `DROP TABLE provider_credentials`.
- Quitar la columna `sessions.courtesy` y la función RPC de cortesía si existe.

`apps/api/src/db/schema.ts`: `Provider = '9router'`, `Profile.plan`,
`Profile.plan_expires_at`.

## Interfaces

### Entorno (`apps/api/src/config/env.ts`, `.env.example`)

```
NINEROUTER_URL=https://…/v1        (z.url())
NINEROUTER_API_KEY=…               (z.string().min(1))
TURNS_DAILY_CAP_FREE=30            (int ≥ 0; 0 desactiva)
TURNS_DAILY_CAP_PRO=120
FALLBACK_MODELS                    ya no es obligatoria; default [{ "provider":"9router","model":"fluent-free" }]
```
Se eliminan en F5: `CREDENTIALS_MASTER_KEY`, `CREDENTIALS_MASTER_KEY_PREVIOUS`,
`OPENROUTER_OAUTH_CALLBACK`.

### `LlmService`

```ts
interface LlmServiceRequest<T> {
  userId: string; sessionId?: string | null; purpose: Purpose;
  messages: readonly LlmMessage[]; schema: ZodType<T>;
  plan: Plan;                              // 'free' | 'pro'  (antes: credentials)
  preference?: ModelPreference | null;
  promptVersion?: string; maxTokens?: number; temperature?: number;
  timeoutMs?: number; maxAttempts?: number;
  onToken?: (delta: string) => void; onReset?: () => void;
}
// LlmServiceResult<T> sin cambios: { data, modelUsed, provider, usage, degraded, attempts }
```

### `ModelResolver.resolve({ plan, preference, fallbackModels? }) → { candidates, preferenceDropped }`

`Candidate = { provider: '9router', model: string, source: 'preference' | 'fallback' }` (sin `apiKey`).

### HTTP

- `GET /me` → `{ profile, group, plan: 'free'|'pro', planExpiresAt: string|null, modelPreference, onboarded, activeSessionId, interestsCatalog, pendingActions[] }`. Sin `providers`.
- `PUT /me/models` `{ chatProvider: '9router', chatModel, briefProvider: '9router', briefModel }` → `403 PLAN_REQUIRED` si Free y algún modelo tiene tier ≠ free; `400 MODEL_NOT_AVAILABLE` si el id no está en el catálogo.
- `GET /models` → `{ providers: { '9router': { free, budget, premium } }, estimatePerSession }`.
- `PUT /admin/users/:id/plan` `{ plan: 'free'|'pro', expiresAt?: string|null }` → `{ userId, plan, planExpiresAt }`. Solo `OWNER_USER_ID`; otro usuario `403 FORBIDDEN`.
- `POST /webhooks/revenuecat` (F4, `@Public()`): cabecera `Authorization: Bearer ${REVENUECAT_WEBHOOK_SECRET}`; cuerpo según RevenueCat; escribe `plan` y `plan_expires_at` por `app_user_id = userId`.

### Códigos de error (`common/api-error.ts`)

- Nuevo: `PLAN_REQUIRED: 403`.
- Se eliminan en F5: `PROVIDER_NOT_CONNECTED`, `PROVIDER_KEY_INVALID`.

### `mapError(error): LlmErrorStatus`

| Origen | Estado |
| --- | --- |
| `NoObjectGeneratedError`, zod falla | `invalid_json` |
| `APICallError` 401/403 | `auth_error` |
| `APICallError` 429 | `rate_limited` |
| `APICallError` otro / `error` part en `fullStream` | `provider_error` |
| `AbortError` (signal) | `timeout` |

## Hallazgos del router real (2026-09-23)

Medidos contra `NINEROUTER_URL` con la key del operador. Son contrato para F1.

| Hallazgo | Consecuencia |
| --- | --- |
| Sin el campo `stream`, 9router responde `text/event-stream` y para Gemini manda chunks SSE aunque no se pidiera streaming. Con `stream: false` explícito responde `application/json` limpio. | Toda petición lleva `stream` explícito. Como el SDK omite la clave en `generateObject`, `ninerouter.provider.ts` envuelve `fetch` y añade `stream: false` cuando falta. |
| El SDK manda `reasoning_effort` desde `providerOptions['9router'].reasoningEffort`. `ds/*` sin razonamiento solo con `'none'` (con `'low'` agota `max_tokens` pensando); `gemini/gemini-3.8*` rechaza `'none'` (400) y acepta `'low'`; `openai/gpt-oss-120b` (primer modelo de `fluent-free`, servido por Groq) con `'low'` responde JSON válido en ~1 s; los `cf/*` lo ignoran. | Mapa `REASONING_EFFORT` por modelo o combo en `ninerouter-models.ts`: `fluent-free` → `low`, `fluent-pro` → `none`, `ds/*` → `none`, `gemini/gemini-3.8*` → `low`, resto sin valor. `fluent-pro` no debe contener modelos que rechacen `none`. |
| `gemini/gemini-3.5-flash-lite` envuelve el JSON en vallas ```` ```json ```` incluso con `response_format: json_object`. | `experimental_repairText` quita vallas y extrae el primer objeto (`json.ts`). |
| `openai/gpt-5.x` rechaza `max_tokens` (exige `max_completion_tokens`) y el SDK manda `max_tokens`. | OpenAI fuera de los combos y del catálogo. |
| Los 8 modelos `nvidia/*` responden 410 (fin de vida) o 404. `openrouter/typesafe/jev-1.13` es un modelo de "decisions", no de chat. | NVIDIA fuera. En OpenRouter hay que añadir a mano los `:free` en el panel de 9router. |
| `cf/@cf/zai-org/glm-4.7-flash`, `cf/@cf/qwen/qwq-32b` y `cf/@cf/moonshotai/kimi-*` razonan hasta agotar `max_tokens`. `cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast` (2–6 s) y `cf/@cf/mistralai/mistral-small-3.1-24b-instruct` (1,6 s) dan JSON limpio. | Solo esos dos de Cloudflare en `fluent-free`. |
| `fluent-pro` = `ds/deepseek-v4-flash` → `gemini/gemini-3.5-flash-lite`, probado con `reasoning_effort: none`: JSON válido en 1–2 s, con y sin streaming. `fluent-free` con `low`: JSON válido en ~1 s. | Composición de referencia de los combos; el bench de F1.6 la revalida. |
| Cloudflare delante del router bloquea el User-Agent de `urllib` de Python (403 código 1010); `curl`, `node` y `undici` pasan. | Nada que hacer en la API. El bench no debe usar `urllib`. |
| `prompt_tokens` llega inflado en unos 2 000 tokens fijos: `open-sse/utils/usageTracking.js` de 9router suma `BUFFER_TOKENS = 2000` «to prevent context errors» en `stream.js` y `nonStreamingHandler.js`. El modelo no recibe nada extra (llama y gemini confirman contexto vacío; los ahorradores Caveman y Ponytail están apagados; solo RTK activo). En algunas rutas de Groq el buffer no se aplica. | Contabilidad, no coste real. `LlmService` resta `NINEROUTER_USAGE_BUFFER = 2000` a `tokensIn` cuando `tokensIn > 2000`, con comentario que cite el fichero de 9router; si no, la estimación por sesión de `GET /models` sale 2 a 3 veces alta. |
| 9router responde 400 tal cual cuando el primer modelo del combo falla con 400 (id inválido, `json_validate_failed`). | El combo no cubre errores de petición: `LlmService` sigue tratando 4xx como `provider_error` y pasa al siguiente candidato (`fluent-free`). |

## Decisions

- **D1 — Cliente LLM.** Chosen: Vercel AI SDK 7 con `@ai-sdk/openai-compatible`. Rejected: mantener `llm.client.ts` porque son 700 líneas que hacen lo mismo que el SDK y sin tests de terceros.
- **D2 — Fallback entre proveedores.** Chosen: combos de 9router. Rejected: cadena `FALLBACK_MODELS` larga en la API, porque duplica lo que 9router ya hace y multiplica los reintentos.
- **D3 — Salida estructurada.** Chosen: `json_object` + instrucción en el prompt + `experimental_repairText` con `extractFirstJsonObject`. Rejected: `supportsStructuredOutputs` porque manda `json_schema` estricto y los free tiers lo rechazan.
- **D4 — Transición.** Chosen: en F1 `CredentialsService.listActive` devuelve la credencial del operador, así sesiones y jobs no cambian hasta F5. Rejected: reescribir sesiones y jobs en F1, porque dispara el tamaño del PR y no aporta nada al usuario.
- **D5 — Verdad del plan.** Chosen: columna en `profiles` escrita solo por la API. Rejected: consultar RevenueCat en cada petición, por latencia y por acoplar el turno a un tercero.
- **D6 — Reintentos.** Chosen: `maxRetries: 0` en el SDK para turnos, `TURN_MAX_ATTEMPTS = 2` en `LlmService`. Rejected: dejar los 2 reintentos del SDK, porque con los de 9router suman más de un minuto de silencio.

## Risks

- Cuotas gratuitas compartidas por todos los usuarios, *mitigation:* tope diario Free de 30 desde el día uno y combo con cuatro proveedores.
- Free tiers que no respetan `response_format`, *mitigation:* bench de F1.6 antes de fijar el combo; `repairText` conserva la tolerancia actual.
- 9router en el mismo VPS que la API, *mitigation:* healthcheck y `restart: always` en el runbook; la degradación de SPEC-03 §6 sigue devolviendo 200.
- Términos de uso de conexiones OAuth de IDE, *mitigation:* fuera de los combos (RNF-5).
- Un plan pago fuera de IAP en iOS es rechazo de la tienda, *mitigation:* F4 solo por RevenueCat.

## Requirement coverage

| Requirement | Component(s) |
| --- | --- |
| RF-1 | LLM provider, Operator credential, Entorno |
| RF-2 | LLM provider, LlmService |
| RF-3 | Data model (F2), Plans |
| RF-4 | ModelResolver |
| RF-5 | ModelResolver, Plans (`PLAN_REQUIRED`) |
| RF-6 | Plans (`requireDailyTurnsBudget`) |
| RF-7 | Plans (admin) |
| RF-8 | Plans (`GET /me`) |
| RF-9 | Catalog |
| RF-10 | Mobile |
| RF-11 | Operator credential (jobs) |
| RF-12 | Mobile (verificación manual en InsForge, fuera de tareas) |
| RF-13 | Billing |
| RF-14 | F5 limpieza y docs |
| RNF-1 | F1.6 bench |
| RNF-2 | LLM provider (key solo en entorno) |
| RNF-3 | LlmService (sink `llm_calls`) |
| RNF-4 | LlmService (D6) |
| RNF-5 | Prerrequisito del operador en el PRD |

## Work breakdown

### F1 — API habla con 9router por el Vercel AI SDK
- **F1.1 — proveedor**: deps, `ninerouter.provider.ts`, env, `config.ts`. Files: `apps/api/package.json`, `apps/api/src/llm/ninerouter.provider.ts`, `apps/api/src/llm/config.ts`, `apps/api/src/llm/llm-infra.module.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.example`, `apps/api/.env.test`.
- **F1.2 — servicio LLM**: `LlmService` sobre `generateObject`/`streamObject`, `mapError`, borrar cliente y parser. Depends on: F1.1. Files: `apps/api/src/llm/llm.service.ts`, `llm.service.spec.ts`, `llm.client.ts`, `llm.client.spec.ts`, `stream-reply-parser.ts`, `stream-reply-parser.spec.ts`, `bench-turns.spec.ts`, `model-resolver.ts`, `model-resolver.spec.ts`.
- **F1.3 — credencial del operador**: `CredentialsService.listActive` y los dos jobs. Depends on: F1.1. Files: `apps/api/src/credentials/credentials.service.ts`, `credentials.service.spec.ts`, `apps/api/src/jobs/coaching-brief/*`, `apps/api/src/jobs/weekly-summary/*`, `apps/api/src/profiles/pending-actions.service.ts`.
- **F1.4 — catálogo**: `ninerouter-models.ts`, `catalog.service.ts`, `models.service.ts`. Depends on: F1.1. Files: `apps/api/src/llm/ninerouter-models.ts`, `catalog.service.ts`, `catalog.service.spec.ts`, `gemini-models.ts`, `apps/api/src/models/models.service.ts`, `models.service.spec.ts`, `models.types.ts`, `models.mapper.ts`.
- **F1.5 — migración**: CHECK y reset. Files: `apps/api/migrations/20260923120000_9router.sql`, `apps/api/src/db/schema.ts`.
- **F1.6 — bench**: `bench-models.ts` sobre el SDK. Depends on: F1.1. Files: `apps/api/scripts/bench-models.ts`.

### F2 — Planes Free y Pro en la API
- **F2.1 — datos del plan**: migración, `schema.ts`, `profiles/plan.ts`. Files: `apps/api/migrations/20260923130000_planes.sql`, `apps/api/src/db/schema.ts`, `apps/api/src/profiles/plan.ts`, `plan.spec.ts`.
- **F2.2 — plan en el LLM**: resolver por plan, `PLAN_REQUIRED`, topes. Depends on: F2.1, F1.2, F1.4. Files: `apps/api/src/llm/model-resolver.ts`, `model-resolver.spec.ts`, `apps/api/src/llm/llm.service.ts`, `apps/api/src/models/models.service.ts`, `models.service.spec.ts`, `apps/api/src/sessions/turns.service.ts`, `turns.service.spec.ts`, `apps/api/src/sessions/sessions.service.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.example`, `apps/api/src/common/api-error.ts`.
- **F2.3 — plan en HTTP**: `GET /me` y admin. Depends on: F2.1. Files: `apps/api/src/profiles/profiles.types.ts`, `profiles.service.ts`, `profiles.service.spec.ts`, `apps/api/src/admin/admin.controller.ts`, `admin.service.ts`, `admin.service.spec.ts`, `admin.repository.ts`, `apps/api/src/admin/dto/*`.

### F3 — App móvil sin proveedores, con plan
- **F3.1 — contrato de API**: `core/api` sin proveedores, con plan. Files: `apps/mobile/lib/core/api/fluent_api.dart`, `http_fluent_api.dart`, `fake_api.dart`, `models.dart`, `models.g.dart`, `models.freezed.dart`, `apps/mobile/test/core/api/*`.
- **F3.2 — quitar proveedores**: borrar `features/providers`, ruta, ajustes, onboarding. Depends on: F3.1. Files: `apps/mobile/lib/features/providers/**`, `apps/mobile/lib/features/auth/data/oauth_launcher.dart`, `apps/mobile/lib/app/router.dart`, `apps/mobile/lib/core/providers.dart`, `apps/mobile/lib/features/onboarding/presentation/onboarding_flow.dart`, `apps/mobile/lib/features/home/**`, `apps/mobile/test/features/providers/**`, `apps/mobile/test/features/onboarding/**`, `apps/mobile/test/features/home/**`.
- **F3.3 — pantalla de plan**: `plan_screen.dart`, selector de modelo solo Pro, l10n, errores. Depends on: F3.1. Files: `apps/mobile/lib/features/settings/**`, `apps/mobile/lib/l10n/*.arb`, `apps/mobile/lib/l10n/gen/*`, `apps/mobile/lib/core/errors/l10n_for_api_error.dart`, `apps/mobile/test/features/settings/**`.

### F4 — Cobro del plan Pro
- **F4.1 — webhook**: `billing/` con RevenueCat. Depends on: F2.3. Files: `apps/api/src/billing/**`, `apps/api/src/app.module.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.example`.
- **F4.2 — compra en la app**: `purchases_flutter`. Depends on: F3.3, F4.1. Files: `apps/mobile/pubspec.yaml`, `apps/mobile/lib/features/settings/presentation/plan_screen.dart`, `apps/mobile/lib/core/billing/**`.

### F5 — Limpieza y documentación
- **F5.1 — borrar BYOK**: módulos, tabla, cortesía, env. Depends on: F1.3, F2.2, F3.2. Files: `apps/api/src/providers/**`, `apps/api/src/credentials/**`, `apps/api/src/sessions/*`, `apps/api/src/jobs/**`, `apps/api/src/app.module.ts`, `apps/api/src/worker.module.ts`, `apps/api/src/config/env.ts`, `apps/api/.env.example`, `apps/api/.env.test`, `apps/api/src/common/api-error.ts`, `apps/api/src/db/schema.ts`, `apps/api/migrations/20260923140000_borrar-byok.sql`, `apps/api/test/*`.
- **F5.2 — documentación**: ADR 0005, PRD, SPEC-02/03/08, runbook. Depends on: F5.1. Files: `docs/adr/0005-llm-via-9router-y-planes.md`, `docs/adr/0002-byok-y-proveedores-de-llm.md`, `docs/adr/README.md`, `docs/PRD.md`, `docs/specs/SPEC-02-auth-y-api.md`, `docs/specs/SPEC-03-llm-y-prompts.md`, `docs/specs/SPEC-08-infraestructura.md`, `docs/runbooks/despliegue.md`.
