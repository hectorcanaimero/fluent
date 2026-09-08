# PR-03 — LLM, proveedores y prompts · rama `feat/llm` · SPEC-03

Sesión líder: Opus 5. Empieza ya. Este PR no toca la base de datos: es un módulo puro con tests, para que PR-04 y PR-05 lo consuman.

## T1 · Esquemas de salida y catálogo de categorías
- Modelo: Sonnet 5 · Depende de: nada · Bloquea a: T2, T4
- Alcance: `apps/api/src/llm/schemas.ts` con `CATEGORIES`, `TurnOutput`, `BriefOutput`, `WeeklyOutput` exactamente como SPEC-03 §5; `apps/api/src/llm/json.ts` con `extractFirstJsonObject(text)` tolerante (bloques ```json, texto antes y después, llaves balanceadas).
- Aceptación: tests con 12 salidas reales de modelos gratuitos guardadas en `fixtures/llm/` (incluidas 4 malformadas) y el resultado esperado.
- Commit: `feat(llm): esquemas de salida y extracción tolerante de JSON`

## T2 · Adaptador `LlmClient`
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: T3, T4, PR-04, PR-05
- Alcance: `apps/api/src/llm/llm.client.ts` con la firma de SPEC-03 §1, tabla de proveedores, `response_format` cuando aplique, timeout con `AbortController`, mapeo de errores HTTP a `status` de `llm_calls` (`invalid_json`, `provider_error`, `rate_limited`, `auth_error`, `no_credits`), usage y latencia. Sin dependencias de NestJS: clase pura inyectable.
- Aceptación: tests con `fetch` simulado que cubren 200 válido, 200 con JSON roto, 401, 402, 429, 500, timeout. Nunca loguea la key (test que revisa la salida del logger).
- Commit: `feat(llm): adaptador único compatible con OpenAI para OpenRouter y Gemini`

## T3 · `ModelResolver` y política de fallback
- Modelo: Opus 5 · Depende de: T2 · Bloquea a: PR-04, PR-05
- Alcance: `apps/api/src/llm/model-resolver.ts`: construye candidatos a partir de preferencia del usuario, credenciales activas y `FALLBACK_MODELS`; `apps/api/src/llm/llm.service.ts` orquesta hasta 3 intentos según SPEC-03 §2, emite un evento `credential.error` con `{userId, provider, code}` (lo consume PR-02/T4 para marcar la credencial) y devuelve `{data, modelUsed, degraded, attempts[]}`; registra cada intento en `llm_calls` a través de una interfaz `LlmCallSink` (PR-02 la implementa con InsForge).
- Aceptación: tests: usuario con modelo pago que falla 402 → siguiente gratuito y evento emitido; sin credenciales → `LLM_UNAVAILABLE`; JSON inválido dos veces y válido a la tercera → `degraded: true`.
- Commit: `feat(llm): resolución de modelo y cadena de fallback`

## T4 · Prompts tipados
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: PR-04, PR-05
- Alcance: `apps/api/src/llm/prompts/turn.ts`, `brief.ts`, `weekly.ts` con funciones puras que reciben datos tipados y devuelven `messages[]` exactamente según SPEC-03 §4, incluidos `opening_rule`, bloques por `kind` y los idiomas derivados de `locale` (`native_language`, `note_language`, `summary_language`); `PROMPT_VERSION`; truncados de SPEC-03 §3 (`truncateHistory`, `truncateTranscript`).
- Aceptación: snapshot tests de los tres prompts con datos de ejemplo; test de que el historial nunca supera 8 turnos ni 600 caracteres por turno.
- Commit: `feat(llm): prompts de turno, brief y resumen semanal`

## T5 · Catálogo de modelos y estimación de costo
- Modelo: Sonnet 5 · Depende de: T2 · Bloquea a: PR-02/T5
- Alcance: `apps/api/src/llm/catalog.service.ts`: descarga y cachea el catálogo de OpenRouter (interfaz `CacheStore`, PR-08/T3 la implementa con Redis), lista fija de Gemini, tiers y filtro de SPEC-03 §7, `estimatePerSession(avgIn, avgOut, model)`.
- Aceptación: test con una respuesta real de `/models` guardada en fixtures: 3 tiers correctos, exclusión de modelos sin texto o contexto < 8k.
- Commit: `feat(llm): catálogo de modelos por tiers y costo estimado por sesión`

## T6 · Contenido: roleplays, temas y boss topics
- Modelo: Haiku 4.5 · Depende de: nada · Bloquea a: PR-04/T3
- Alcance: `apps/api/src/content/roleplays.json` (30, SPEC-03 §8), `topics.json` (60 con tags del catálogo de intereses), `boss-topics.json` (40), `interests.json` (catálogo de 24 intereses con tags), con tipos en `content/index.ts` y validación zod al cargar.
- Aceptación: test que carga y valida los cuatro archivos; ids únicos; `level_min` válido.
- Commit: `feat(content): roleplays, temas, boss topics e intereses`

## T7 · Script de banco de pruebas de modelos
- Modelo: Sonnet 5 · Depende de: T2, T4 · Bloquea a: fijar `FALLBACK_MODELS`
- Alcance: `apps/api/scripts/bench-models.ts` según SPEC-03 §9, con 20 turnos sintéticos en `fixtures/bench/turns.json` (cada uno con 2 errores plantados y sus categorías) y salida en tabla Markdown a `docs/specs/bench-<fecha>.md`. Lee las keys de variables de entorno del operador.
- Aceptación: ejecución real por el operador con sus keys; el resultado se pega en la spec y define `FALLBACK_MODELS`.
- Commit: `feat(llm): banco de pruebas de modelos gratuitos`
