---
type: spec
project_id: fluent
phase: 13
version: 0.1
depends_on:
  - docs/arch/003-simulador-entrevistas.md
  - docs/prd/003-simulador-entrevistas.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-18
title: Simulador de entrevistas — ciclo de estudio y re-entrevista
---

# F13 — Ciclo de estudio y re-entrevista

Del parecer sale un ciclo de 5 sesiones que se desbloquean en orden; al
completarlo, una re-entrevista sobre la misma oferta compara el avance por
competencia. Las sesiones del ciclo se suman a las del día y cuentan para XP y
racha.

Arquitectura: `docs/arch/003-simulador-entrevistas.md`, C2, C4 (sesiones
`study`), C5, I2 y D6. Requisitos: FR-17 a FR-19, FR-29, FR-30, FR-32.
Diseño: IE-07 e IE-08 de `docs/design/fluentv3.pen` (sin compartir; tuteo).

## F13.1 — Package: API del ciclo

### F13.1.T1 — Ciclo de estudio y sesiones study

- `POST /interviews/:id/cycle`: desde `feedback_ready`, crea `study_cycles` y
  sus 5 `study_cycle_sessions` desde `feedback.studyPlan`; idempotente (si ya
  existe, lo devuelve).
- `GET /interviews/:id/cycle`: sesiones con estado `done`, `available` (la
  primera no hecha) o `locked`, más "n de 5" y duración total.
- `POST /interviews/:id/cycle/sessions/:idx/start`: 409 si una anterior no
  está hecha (FR-29); crea una sesión `kind = 'study'` con
  `study_cycle_session_id` y `topic = title`.
- `scenario.ts`: `studyScenario` desde la fila del ciclo; el prompt de turno
  normal recibe un bloque de foco con `brief` y el formato (`guided` =
  conversación guiada sobre el tema; `roleplay` = situación de trabajo).
  Correcciones visibles como en cualquier sesión.
- Al cerrar una sesión `study` con el flujo normal, marcar `done_at`; al
  completar las 5, el ciclo pasa a `completed`.

Done when: specs cubren crear el ciclo dos veces (una sola fila), arrancar la
3 sin la 2 → 409, la sesión `study` usa el foco en el prompt (snapshot), y
cerrar la quinta completa el ciclo.

- **Model**: claude/opus
- **Estimate**: 6h
- **Reason**: Toca escenarios y cierre de sesiones; riesgo de regresión en el núcleo.
- **Dependencies**: F12.3.T1
- **Files**:
  - `apps/api/src/interviews/study-cycle.service.ts`
  - `apps/api/src/interviews/study-cycle.service.spec.ts`
  - `apps/api/src/interviews/interviews.controller.ts`
  - `apps/api/src/interviews/interviews.repository.ts`
  - `apps/api/src/sessions/scenario.ts`
  - `apps/api/src/sessions/session-closer.service.ts`
  - `apps/api/src/llm/prompts/turn.ts`

### F13.1.T2 — Re-entrevista y recordatorio del ciclo

- `POST /interviews/:id/reinterview`: solo con el ciclo `completed`; crea una
  entrevista hija (`parent_interview_id`) con la misma oferta y tipo, consume
  el tope diario y encola `interview-prepare` pasando la rúbrica de la padre
  como `fixedRubric` (I1), para que la comparación sea entre las mismas
  competencias; las preguntas anteriores ya están en
  `interview_questions_asked`, así que no se repiten (FR-19, FR-20).
  El job `interview-feedback` ya pasa `previousFeedback` (F12.3.T1); verificar
  que `comparison` se guarda.
- Si la comparación tiene competencias con `trend = down`, el `studyPlan` del
  nuevo parecer las incluye (lo garantiza el agente; aquí solo un test de
  integración con el cliente falso).
- Cron diario `study-reminder` en la cola `maintenance` (hora 18:00 en la zona
  del usuario, como los recordatorios existentes si aplica): para ciclos
  `active` cuya última sesión hecha fue ayer y la siguiente no se hizo, push
  `notifyStudyReminder`; máximo uno por día y nunca dos días seguidos (guardar
  la fecha del último envío en Redis).

Done when: specs cubren re-entrevista sin ciclo completo → 409, con ciclo →
entrevista hija en `preparing`, y el cron envía una vez y no al día siguiente.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Lógica acotada sobre piezas ya existentes.
- **Dependencies**: F13.1.T1
- **Files**:
  - `apps/api/src/interviews/interviews.controller.ts`
  - `apps/api/src/interviews/interviews.service.ts`
  - `apps/api/src/interviews/interviews.service.spec.ts`
  - `apps/api/src/jobs/maintenance/`

## F13.2 — Package: app del ciclo

### F13.2.T1 — Pantalla del ciclo de estudio

Pantalla `/interviews/:id/cycle` (IE-07): título "Tu ciclo de estudio",
"Armado con tu parecer de {empresa}", progreso "n de 5 sesiones", duración
total, filas de sesión (foco, título, duración, formato, estado Hecha /
Empezar / bloqueada) y la re-entrevista bloqueada hasta completar las 5. Desde
el parecer (F12.4.T2) "Empezar ciclo de estudio" llama `POST /cycle` y abre
esta pantalla. "Empezar" llama `start` y abre la conversación normal con el
`sessionId` devuelto (con revisión y correcciones visibles).

Done when: widget tests cubren el desbloqueo en orden, que una sesión
bloqueada no se puede tocar y que "Empezar" abre la conversación.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: UI de lista con estados.
- **Dependencies**: F12.4.T2, F13.1.T1
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/cycle/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/cycle/`

### F13.2.T2 — Re-entrevista y comparación

- En IE-07, con el ciclo completo, "Re-entrevista" llama
  `POST /interviews/:id/reinterview` y navega a la preparación de la
  entrevista hija.
- Pantalla `/interviews/:id/compare` (IE-08): "Así cambiaste", filas por
  competencia con antes → después y Avanzó / Igual / Retrocedió, fila de
  inglés con errores repetidos antes → después, aviso "Comparación orientativa
  generada por IA" y "Ver el parecer completo". Sin compartir. El parecer de
  una re-entrevista enlaza a esta pantalla.

Done when: widget tests cubren la comparación con los tres estados y la
navegación de re-entrevista con `FakeFluentApi`.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: UI de lectura sobre datos ya calculados.
- **Dependencies**: F13.2.T1, F13.1.T2
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/compare/`
  - `apps/mobile/lib/features/interviews/presentation/cycle/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/compare/`
