# PR-02 — Auth y API · rama `feat/api` · SPEC-02

Sesión líder: Opus 5. Empieza cuando PR-08/T1 y PR-01/T1 estén fusionados. Trabaja sobre una rama de InsForge `feat-api` hija de la principal.

## T1 · `AuthGuard` por introspección con caché
- Modelo: Opus 5 · Depende de: PR-08/T3 · Bloquea a: todo lo demás del PR
- Alcance: `apps/api/src/auth/auth.guard.ts` según SPEC-02 §2, decorador `@CurrentUser()`, `@Public()` para health, caché en Redis por hash del token con TTL 300 s, invalidación en logout no requerida (el TTL basta).
- Aceptación: tests: token válido → una sola llamada a InsForge en 5 minutos; token inválido → 401 `UNAUTHENTICATED`; sin cabecera → 401.
- Commit: `feat(api): guard de autenticación con introspección y caché`

## T2 · Cuenta, perfil e invitaciones
- Modelo: Sonnet 5 · Depende de: T1, PR-01/T1, PR-01/T6 · Bloquea a: PR-06 onboarding real
- Alcance: `ProfilesModule`, `GroupsModule`: `GET /me`, `PUT /me/profile`, `POST /invitations/redeem` (RPC), `POST /admin/invitations` (solo `OWNER_USER_ID`), `GET /group`, `DELETE /me`. Repositorios sobre el cliente admin. DTOs con validación (3 a 5 intereses del catálogo de PR-03/T6, `timezone` IANA válida).
- Aceptación: e2e con supertest contra la rama de InsForge: flujo registro → canje → `/me` con `onboarded`; errores `INVITATION_*` y `ALREADY_IN_GROUP`.
- Commit: `feat(api): perfil, grupo e invitaciones`

## T3 · Manejo de errores y límites
- Modelo: Sonnet 5 · Depende de: T1 · Bloquea a: PR-04
- Alcance: filtro global que produce el formato de SPEC-02 §6 para excepciones de Nest, zod y errores de InsForge; `@nestjs/throttler` con los límites de SPEC-02 §7 y clave por usuario; `RATE_LIMITED` 429.
- Aceptación: tests de formato de error para 400, 401, 403, 404, 429, 500 (sin filtrar stack en producción).
- Commit: `feat(api): formato de errores y rate limiting`

## T4 · Credenciales cifradas y proveedores
- Modelo: Opus 5 · Depende de: T1, PR-01/T2 · Bloquea a: T5, PR-04
- Alcance: `CredentialsService` con AES-256-GCM según SPEC-02 §5 (incluida clave previa para rotación); `ProvidersModule`: PKCE de OpenRouter (`start` genera verifier S256 y lo guarda en Redis 10 min; `complete` canjea en `https://openrouter.ai/api/v1/auth/keys` con `{code, code_verifier, code_challenge_method}`), `POST /providers/gemini` con validación contra `/models`, `DELETE`, `GET /providers/:p/status` con créditos de OpenRouter. Escucha `credential.error` de PR-03/T3 y marca `status`/`last_error`. Implementa `LlmCallSink` escribiendo en `llm_calls`.
- Aceptación: tests unitarios de cifrado (round trip, AAD incorrecto falla, rotación); e2e simulando OpenRouter con `nock`: PKCE completo, key inválida de Gemini → `PROVIDER_KEY_INVALID`.
- Commit: `feat(api): credenciales cifradas, PKCE de OpenRouter y proveedor Gemini`

## T5 · Catálogo y preferencias de modelo
- Modelo: Sonnet 5 · Depende de: T4, PR-03/T5 · Bloquea a: PR-06 pantalla de modelos
- Alcance: `GET /models` (catálogo + `estimatePerSession` con promedios de `llm_calls` del usuario o valores por defecto), `PUT /me/models` con validación de credencial activa y modelo en catálogo (`MODEL_NOT_AVAILABLE`).
- Aceptación: e2e: usuario sin Gemini elige modelo Gemini → 400; con credencial → 200 y `/me` lo refleja.
- Commit: `feat(api): catálogo de modelos y preferencias por rol`

## T6 · Memoria
- Modelo: Sonnet 5 · Depende de: T1, PR-01/T4 · Bloquea a: PR-06 pantalla de memoria
- Alcance: `MemoryModule`: `GET /memory`, `PATCH /memory/facts/:id`, `DELETE /memory/facts/:id`, `PUT /memory/brief` (máx 600), `DELETE /memory`.
- Aceptación: e2e: confirmar y descartar hechos; el usuario B no puede tocar hechos de A (403 o 404).
- Commit: `feat(api): endpoints de memoria`

## T7 · Progreso, leaderboard, desafíos y resumen
- Modelo: Sonnet 5 · Depende de: T1, PR-01/T5, PR-07/T2 · Bloquea a: PR-06 pantallas de grupo y progreso
- Alcance: `GET /progress` (niveles de SPEC-07 §1, tendencia de correcciones 30/7 días), `GET /leaderboard`, `GET /challenges` (SPEC-07 §7), `GET /weekly-summary` (`NOT_READY`).
- Aceptación: e2e con datos sembrados por un script de fixtures.
- Commit: `feat(api): progreso, leaderboard, desafíos y resumen semanal`

## T8 · OpenAPI y métricas de operador
- Modelo: Haiku 4.5 · Depende de: T2 a T7 · Bloquea a: nada
- Alcance: `@nestjs/swagger` en `/v1/docs` según SPEC-02 §8; `GET /admin/metrics` (SPEC-02 §4.6) con conteos de BullMQ si el módulo de PR-05 está presente, si no, sin esa sección.
- Aceptación: `GET /v1/docs-json` válido; `admin/metrics` 403 para no owner.
- Commit: `feat(api): documentación OpenAPI y métricas del operador`
