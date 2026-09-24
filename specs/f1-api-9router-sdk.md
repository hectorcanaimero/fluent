---
type: spec
project_id: fluent
phase: 1
version: 0.1
depends_on:
  - docs/arch/001-9router-y-planes.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-09-23
title: API habla con 9router por el Vercel AI SDK
---

# F1 — API habla con 9router por el Vercel AI SDK

La API deja de usar credenciales de usuario y el cliente HTTP a mano. Un
proveedor `createOpenAICompatible` apuntando al 9router del operador, y
`LlmService` sobre `generateObject`/`streamObject`. Al terminar la fase, el
producto funciona igual que hoy para el usuario pero ningún aprendiz necesita
conectar nada. Arquitectura: `docs/arch/001-9router-y-planes.md`.

Contexto del repo: `apps/api` es NestJS 12 en ESM sobre Node 24 con vitest
(`pnpm --filter @fluent/api test`), lint con `oxlint`. Los imports internos
llevan sufijo `.js`. Comentarios y mensajes en español, como el resto del código.

## F1.1 — Package: proveedor

### F1.1.T1 — Proveedor 9router con el Vercel AI SDK

Añadir `ai` y `@ai-sdk/openai-compatible` (AI SDK 7.x) a `apps/api/package.json`
con `pnpm --filter @fluent/api add ai @ai-sdk/openai-compatible`.

Crear `apps/api/src/llm/ninerouter.provider.ts` que exporte el token
`NINEROUTER_PROVIDER` y una factory `createNineRouterProvider(env)` que devuelva
`createOpenAICompatible({ name: '9router', baseURL: env.NINEROUTER_URL, apiKey: env.NINEROUTER_API_KEY, includeUsage: true })`.
No activar `supportsStructuredOutputs` (decisión D3 de la arquitectura).
Pasar un `fetch` propio que, si el cuerpo JSON de la petición no trae la clave
`stream`, la añada con `false` antes de llamar a `globalThis.fetch` (hallazgo 1
de la arquitectura: sin ella 9router responde SSE aunque no se pida). El
nombre `'9router'` importa: es la clave de `providerOptions` que F1.2 usa para
`reasoningEffort`.
Registrar el provider en `LlmInfraModule` (`llm-infra.module.ts`) con
`ConfigService` y exportarlo; API y worker lo comparten.

En `apps/api/src/config/env.ts` añadir `NINEROUTER_URL` (`z.url()`) y
`NINEROUTER_API_KEY` (`z.string().min(1)`), obligatorias. `FALLBACK_MODELS`
pasa a opcional. Reflejarlo en `.env.example` y `.env.test` (valores de prueba).

En `apps/api/src/llm/config.ts`: `Provider = '9router'`, `PROVIDER_IDS = ['9router']`,
`PROVIDERS` queda con una sola entrada (`baseUrl` ya no se usa para llamar pero
la mantiene el catálogo), `DEFAULT_FALLBACK_MODELS = [{ provider: '9router', model: 'fluent-free' }]`,
`isProvider` acepta solo `'9router'`. Añadir `PRO_COMBO = 'fluent-pro'` y
`FREE_COMBO = 'fluent-free'`.

Este cambio de tipo rompe `db/schema.ts` (`Provider = 'openrouter' | 'gemini'`):
cambiar ahí también a `'9router'`. Otros ficheros que dejen de compilar por el
tipo (`providers/`, `credentials/`, `models/`, `jobs/`) se arreglan con el
cambio mínimo para que `pnpm --filter @fluent/api build` pase; su reescritura
real es de F1.2 a F1.4 y F5.

Done when: `pnpm --filter @fluent/api build` y `pnpm --filter @fluent/api test`
pasan; `env.spec.ts` cubre que falta `NINEROUTER_URL` tumba el arranque; la key
no aparece en ningún log ni `toString` del provider.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Cableado de dependencias y tipos; sin lógica nueva.
- **Dependencies**:
- **Files**:
  - `apps/api/package.json`
  - `pnpm-lock.yaml`
  - `apps/api/src/llm/ninerouter.provider.ts`
  - `apps/api/src/llm/config.ts`
  - `apps/api/src/llm/llm-infra.module.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.spec.ts`
  - `apps/api/.env.example`
  - `apps/api/.env.test`
  - `apps/api/src/db/schema.ts`

## F1.2 — Package: servicio LLM

### F1.2.T1 — LlmService sobre generateObject y streamObject

Reescribir `apps/api/src/llm/llm.service.ts` para que cada intento use el SDK
en vez de `LlmClient`:

- Sin `onToken`: `generateObject({ model: provider(candidate.model), schema, messages, temperature, maxOutputTokens, abortSignal: AbortSignal.timeout(timeoutMs), maxRetries: 0, experimental_repairText })`.
- Con `onToken`: `streamObject(...)` con los mismos parámetros; recorrer
  `partialObjectStream`, y por cada partial con `reply: string` emitir
  `onToken(reply.slice(previousReply.length))` solo si `reply.startsWith(previousReply)`;
  si no, dejar de emitir (el `done` del SSE manda el objeto entero). Al final
  esperar `object` y `usage`.
- `experimental_repairText: ({ text }) => JSON.stringify(extractFirstJsonObject(text))`
  o `null` si no hay objeto, reutilizando `apps/api/src/llm/json.ts`. Tiene
  que cubrir el JSON envuelto en vallas ```` ```json ```` (Gemini flash-lite lo
  hace incluso con `response_format`).
- `providerOptions: { '9router': { reasoningEffort } }` con el valor de
  `reasoningEffortFor(model)` de `ninerouter-models.ts` (F1.4 lo define; hasta
  que exista, un mapa local: `fluent-free` → `'low'`, `fluent-pro` → `'none'`,
  `ds/` → `'none'`, `gemini/gemini-3.8` → `'low'`, resto `undefined`). Ver la
  tabla «Hallazgos del router real» de la arquitectura: con el valor
  equivocado DeepSeek agota `max_tokens` pensando y Gemini 3.8 responde 400.
- `usage`: 9router suma un buffer fijo de 2 000 a `prompt_tokens` (hallazgo de
  la arquitectura, `BUFFER_TOKENS` en `open-sse/utils/usageTracking.js`). Al
  construir `LlmUsage`, restar `NINEROUTER_USAGE_BUFFER = 2000` (constante en
  `config.ts`) cuando `inputTokens > 2000`; si no, `tokensIn` tal cual. Test
  que lo cubra.
- `stream` siempre explícito: `streamObject` ya manda `stream: true`; para
  `generateObject` lo garantiza el `fetch` de F1.1.
- `mapError(error): LlmErrorStatus` según la tabla de la arquitectura
  (`NoObjectGeneratedError` → `invalid_json`; `APICallError` 401/403 →
  `auth_error`, 429 → `rate_limited`, otro → `provider_error`; abort →
  `timeout`). Un `error` part en `fullStream` cuenta como `provider_error`.
- `usage`: `inputTokens`/`outputTokens` del SDK a `LlmUsage { tokensIn, tokensOut }`,
  `null` cuando el SDK no los da.

Se conservan intactos: `LlmServiceRequest` (por ahora sigue recibiendo
`credentials`, F2.2 lo cambia a `plan`), `LlmServiceResult`, `LlmAttempt`,
`LlmCallSink`, `LlmEventBus`, `LlmUnavailableError`, `onReset`,
`TURN_MAX_ATTEMPTS`, `MAX_ATTEMPTS`, la degradación y el registro en `llm_calls`.
`LlmServiceDeps.client` pasa a `provider: ReturnType<typeof createOpenAICompatible>`.
Los tipos `LlmMessage`, `LlmUsage`, `LlmCallStatus`, `LlmErrorStatus`,
`LlmCallError` se mueven de `llm.client.ts` a `llm/types.ts`.

Borrar `llm.client.ts`, `llm.client.spec.ts`, `stream-reply-parser.ts`,
`stream-reply-parser.spec.ts`. `bench-turns.spec.ts` se adapta o se borra si
solo probaba el cliente.

Tests: reescribir `llm.service.spec.ts` con `MockLanguageModelV3` de `ai/test`
(o el mock que exponga la versión instalada) cubriendo: éxito no streaming,
éxito streaming con deltas de `reply` en orden, `invalid_json` que cae al
siguiente candidato y llama `onReset`, 429 → `rate_limited`, timeout, cadena
agotada → `LlmUnavailableError`, y que cada intento se registra en el sink.

Done when: `pnpm --filter @fluent/api test` y `build` pasan; `grep -r "llm.client" apps/api/src` no devuelve nada; el endpoint SSE de turnos (`sessions/turns.controller.ts`) sigue compilando sin cambios.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 6h
- **Reason**: Núcleo del producto; streaming, reintentos y mapeo de errores con muchos bordes.
- **Dependencies**: F1.1.T1
- **Files**:
  - `apps/api/src/llm/llm.service.ts`
  - `apps/api/src/llm/llm.service.spec.ts`
  - `apps/api/src/llm/types.ts`
  - `apps/api/src/llm/llm.client.ts`
  - `apps/api/src/llm/llm.client.spec.ts`
  - `apps/api/src/llm/stream-reply-parser.ts`
  - `apps/api/src/llm/stream-reply-parser.spec.ts`
  - `apps/api/src/llm/bench-turns.spec.ts`
  - `apps/api/src/llm/llm.module.ts`
  - `apps/api/src/llm/json.ts`

## F1.3 — Package: credencial del operador

### F1.3.T1 — CredentialsService devuelve la credencial del operador

Fase de transición (decisión D4): sesiones y jobs siguen pidiendo credenciales,
pero la respuesta es siempre la del operador.

- `apps/api/src/credentials/credentials.service.ts`: `listActive(userId)` y
  `getActiveApiKey(userId, '9router')` devuelven
  `[{ provider: '9router', apiKey: env.NINEROUTER_API_KEY }]` sin tocar la base.
  `find` devuelve `null`; `saveApiKey`, `remove`, `markCredentialError` quedan
  como no-op con un `warn`. `listStatuses` devuelve `[]`.
- `apps/api/src/jobs/coaching-brief/coaching-brief.service.ts` y
  `apps/api/src/jobs/weekly-summary/weekly-summary.service.ts`: dejan de leer
  filas cifradas y de usar `CredentialsCrypto`; construyen `credentials` con
  la del operador (inyectar `CredentialsService` o `ConfigService`). Sus
  repositorios dejan de seleccionar `provider_credentials`.
- `apps/api/src/jobs/weekly-summary/pending-credential.store.ts` y el aviso
  `weekly_summary_credential_missing` en `profiles/pending-actions.service.ts`
  desaparecen: el resumen semanal ya no puede fallar por credencial. Borrar el
  store y su spec; `pendingActions` en `GET /me` queda como lista vacía si no
  hay otro aviso.

Done when: `pnpm --filter @fluent/api test` pasa; `sessions.service.spec.ts`
y `turns.service.spec.ts` ya no necesitan preparar credenciales para abrir
sesión; ningún job importa `credentials.crypto`.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Cambio mecánico en varios ficheros con tests existentes que guían.
- **Dependencies**: F1.1.T1
- **Files**:
  - `apps/api/src/credentials/credentials.service.ts`
  - `apps/api/src/credentials/credentials.service.spec.ts`
  - `apps/api/src/credentials/credentials.module.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.service.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.service.spec.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.repository.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.module.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.service.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.service.spec.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.repository.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.module.ts`
  - `apps/api/src/jobs/weekly-summary/pending-credential.store.ts`
  - `apps/api/src/jobs/weekly-summary/pending-credential.store.spec.ts`
  - `apps/api/src/profiles/pending-actions.service.ts`
  - `apps/api/src/profiles/pending-actions.service.spec.ts`
  - `apps/api/src/sessions/sessions.service.spec.ts`
  - `apps/api/src/sessions/turns.service.spec.ts`

## F1.4 — Package: catálogo

### F1.4.T1 — Catálogo de modelos desde 9router

- Crear `apps/api/src/llm/ninerouter-models.ts` con `NINEROUTER_MODELS: readonly CatalogModel[]`,
  lista fija del operador con `id`, `name`, `tier`, `pricePerMillionIn`,
  `pricePerMillionOut`, `contextLength` y `reasoningEffort?: 'none' | 'low'`.
  Exportar también `reasoningEffortFor(modelId): string | undefined` (busca el
  id exacto y, si no, el prefijo `ds/` → `'none'`, `gemini/gemini-3.8` → `'low'`).
  Contenido inicial, medido el 2026-09-23 (tabla «Hallazgos del router real»
  de la arquitectura): `fluent-free` (tier `free`, precio 0, effort `low`),
  `fluent-pro` (tier `premium`, effort `none`),
  `cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast` y
  `cf/@cf/mistralai/mistral-small-3.1-24b-instruct` (free),
  `ds/deepseek-v4-flash` (budget, effort `none`),
  `gemini/gemini-3.5-flash-lite` (budget), `gemini/gemini-3.8-flash` (premium,
  effort `low`). **Fuera**: todo `nvidia/*` (fin de vida), `openai/*` (rechaza
  `max_tokens`), `cc/*`, `ag/*`, `gc/*` (cuotas de IDE), `openrouter/typesafe/*`.
  En un comentario, la fuente de cada precio. Borrar `gemini-models.ts`.
- `apps/api/src/llm/catalog.service.ts`: `listModels()` hace
  `GET {NINEROUTER_URL}/v1/models` con `Authorization: Bearer` (cache Redis
  `llm:catalog:9router`, 6 h, misma política de caché y `refresh` que hoy) y
  devuelve la intersección: ids presentes en la respuesta **y** en
  `NINEROUTER_MODELS`, con los datos de la lista fija. Si la respuesta de
  9router no trae un id, no se expone. Quitar el parseo de precios de OpenRouter
  y `tierFromOutputPrice` deja de aplicarse a datos remotos.
- `apps/api/src/models/models.service.ts`: `getCatalog` ya no busca la key del
  usuario; `listCatalogModels` usa la key del operador vía el provider o
  `ConfigService`. `assertRoleIsAvailable` deja de comprobar credencial y solo
  comprueba pertenencia al catálogo (la comprobación de plan llega en F2.2).
- `models.types.ts`: `providers` es `Record<'9router', ModelTierGroupsDto>`.
  `models.mapper.ts` agrupa por el único proveedor.

Done when: `catalog.service.spec.ts` cubre intersección, caché y `refresh`;
`models.service.spec.ts` pasa; `GET /models` en `test/models.e2e-spec.ts`
devuelve `providers['9router']` con `fluent-free` en `free`.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Reescritura acotada con tests existentes.
- **Dependencies**: F1.1.T1
- **Files**:
  - `apps/api/src/llm/ninerouter-models.ts`
  - `apps/api/src/llm/gemini-models.ts`
  - `apps/api/src/llm/catalog.service.ts`
  - `apps/api/src/llm/catalog.service.spec.ts`
  - `apps/api/src/models/models.service.ts`
  - `apps/api/src/models/models.service.spec.ts`
  - `apps/api/src/models/models.types.ts`
  - `apps/api/src/models/models.mapper.ts`
  - `apps/api/src/models/models.mapper.spec.ts`
  - `apps/api/test/models.e2e-spec.ts`

## F1.5 — Package: migración

### F1.5.T1 — Migración: proveedor 9router y limpieza de preferencias

Escribir `apps/api/migrations/20260923120000_9router.sql` siguiendo el estilo
de `apps/api/migrations/20260908190234_proveedores-y-preferencias-de-modelo.sql`
(comentarios en español, REVOKE/GRANT explícitos si se crea algo):

- `model_preferences`: quitar los CHECK de `chat_provider` y `brief_provider`,
  `UPDATE` todas las filas a `chat_provider = '9router'`, `brief_provider = '9router'`,
  `chat_model = 'fluent-free'`, `brief_model = 'fluent-free'`, y volver a crear
  los CHECK con `IN ('9router')` y DEFAULT `'9router'`.
- `provider_credentials`: `DELETE FROM public.provider_credentials;` (la tabla
  se borra en F5).
- Encabezado con la referencia a `docs/arch/001-9router-y-planes.md`.

Registrar la migración donde el runbook `docs/runbooks/insforge.md` indique
(solo el fichero SQL; no aplicarla contra ningún proyecto remoto).

Done when: el SQL corre limpio en una base local con la migración anterior
aplicada (`psql -f`), y un `INSERT` con `chat_provider = 'openrouter'` falla
por el CHECK.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 1h
- **Reason**: SQL corto con un patrón ya en el repo.
- **Dependencies**:
- **Files**:
  - `apps/api/migrations/20260923120000_9router.sql`

## F1.6 — Package: bench

### F1.6.T1 — bench-models.ts sobre el SDK y los combos

Adaptar `apps/api/scripts/bench-models.ts` (SPEC-03 §9) para que use el
provider de F1.1 y `generateObject` con `TurnOutput`, y acepte por argumento la
lista de modelos o combos a medir (por defecto `fluent-free` y `fluent-pro`).
Mantener las métricas: tasa de JSON válido, p50, p90 y detección de al menos 1
de los 2 errores plantados en 20 turnos B1. Salida en tabla por modelo y
exit code 1 si algún modelo queda por debajo de JSON válido ≥ 95 % o p90 ≥ 8 s.
`pnpm --filter @fluent/api bench:models` sigue siendo el comando.

Además de la tabla, imprimir por modelo el promedio de `prompt_tokens` que
reporta el router frente a los tokens estimados del prompt: sirve para vigilar
el system prompt oculto que inyecta 9router (último hallazgo de la tabla de
la arquitectura).

Done when: el script compila con `tsc -p tsconfig.scripts.json` y, con
`NINEROUTER_URL` y `NINEROUTER_API_KEY` reales en el entorno, imprime la tabla.
No hace falta red en CI: un flag `--dry-run` imprime los prompts sin llamar.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Script existente que cambia de cliente.
- **Dependencies**: F1.1.T1
- **Files**:
  - `apps/api/scripts/bench-models.ts`
  - `apps/api/tsconfig.scripts.json`
