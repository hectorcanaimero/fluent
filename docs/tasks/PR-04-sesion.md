# PR-04 — Sesión de conversación · rama `feat/sesion` · SPEC-04

Sesión líder: Opus 5. Empieza cuando PR-02/T1, T3, T4 y PR-03 completo estén fusionados. Es el corazón del producto; la sesión líder revisa cada commit con especial cuidado.

## T1 · Apertura de sesión
- Modelo: Opus 5 · Depende de: PR-01/T3, PR-01/T4, PR-03/T3, PR-03/T4 · Bloquea a: T2
- Alcance: `SessionsModule`, `POST /sessions` según SPEC-04 §3: validación por `kind`, unicidad de sesión activa (`SESSION_ALREADY_ACTIVE` con `activeSessionId`), decisión de callback con `CALLBACK_PROBABILITY` y `pick_callback_fact`, prompt de apertura, persistencia de `sessions` y `turns[0]`, apertura degradada por `kind`.
- Aceptación: e2e con LLM simulado: 4 kinds; segunda sesión activa → 409; callback usado se refleja en `sessions.callback_fact_id` y `facts.last_used_at`; sin credencial → `PROVIDER_NOT_CONNECTED`.
- Commit: `feat(sesion): apertura con callback de memoria`

## T2 · Turno
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: T3, T4
- Alcance: `POST /sessions/:id/turns` según SPEC-04 §4 con lock en Redis, historial acotado, persistencia de turno usuario y tutor, correcciones, `degraded` y `unavailable`.
- Aceptación: e2e: dos turnos concurrentes → uno 409; historial enviado al LLM simulado nunca supera 8 turnos; respuesta degradada tras cadena agotada; `RATE_LIMITED` al superar 20/min.
- Commit: `feat(sesion): turno de conversación con correcciones`

## T3 · Cierre y sugerencias
- Modelo: Sonnet 5 · Depende de: T2, PR-03/T6 · Bloquea a: PR-05/T1, PR-06
- Alcance: `POST /sessions/:id/end` (RPC `close_session`, encolado de `coaching-brief` vía interfaz `JobDispatcher` que PR-05 implementa; hasta entonces, implementación nula que solo loguea); `GET /sessions/suggestions` según SPEC-04 §7; `GET /sessions`, `GET /sessions/:id`.
- Aceptación: e2e: cierre con XP correcto según fixtures; sesión corta sin XP; sugerencias respetan intereses y excluyen roleplays recientes.
- Commit: `feat(sesion): cierre con XP y sugerencias de tema`

## T4 · Streaming SSE (P1)
- Modelo: Opus 5 · Depende de: T2 · Bloquea a: nada
- Alcance: `POST /sessions/:id/turns/stream` con parser incremental del campo `reply` y eventos `token`, `corrections`, `done`, con caída transparente al modo completo.
- Aceptación: test con stream simulado que emite el JSON en trozos arbitrarios; el texto reconstruido coincide con `reply`.
- Commit: `feat(sesion): streaming de la respuesta del tutor`

## T5 · Barrido de sesiones
- Modelo: Sonnet 5 · Depende de: T3 · Bloquea a: PR-05/T4
- Alcance: `SessionSweeperService.run()` según SPEC-04 §6, expuesto para que PR-05 lo programe.
- Aceptación: test: sesión sobre hard cap se cierra con XP; sesión sin turnos 30 min → `abandoned`; abandonada con 2 turnos y 4 min → `ended` con XP.
- Commit: `feat(sesion): barrido de sesiones abandonadas y sobre el límite`
