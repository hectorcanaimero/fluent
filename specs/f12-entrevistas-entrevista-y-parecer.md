---
type: spec
project_id: fluent
phase: 12
version: 0.1
depends_on:
  - docs/arch/003-simulador-entrevistas.md
  - docs/prd/003-simulador-entrevistas.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-18
title: Simulador de entrevistas — entrevista y parecer
---

# F12 — Entrevista y parecer

El tutor entrevista al usuario con el plan preparado (8 preguntas, máximo 10
minutos de tiempo activo, voz sin revisión) y al terminar el agente produce el
parecer técnico y de inglés, que se guarda, alimenta la memoria y se muestra en
la app.

Arquitectura: `docs/arch/003-simulador-entrevistas.md`, C1, C3, C4, C6, I1,
I2, I3 y decisiones D3 a D7. Requisitos: FR-8 a FR-16, FR-24 a FR-27, FR-34,
FR-35. Diseño: frames IE-05 e IE-06a–e de `docs/design/fluentv3.pen` (sin botón
de compartir; copy en tuteo).

## F12.1 — Package: turnos de entrevista

### F12.1.T1 — Prompt y schema del turno de entrevista

Implementar I3:
- `InterviewTurnOutput` en `apps/api/src/llm/schemas.ts` (correcciones con
  `keepValid`, tolerante como `GroupTurnOutput`: una corrección inválida no
  tira la respuesta).
- `buildInterviewTurnMessages` en
  `apps/api/src/llm/prompts/interview-turn.ts`: el tutor es un entrevistador
  del área del plan; habla en inglés, intervenciones de 1–2 frases; en el
  primer turno se presenta y pide respuestas de alrededor de un minuto; sigue
  el orden de las preguntas; repregunta como máximo una vez por pregunta
  (no repregunta las de `followUpUsedFor`) cuando la respuesta es superficial;
  no corrige el inglés en voz alta pero devuelve las correcciones; con
  `activeSec >= INTERVIEW_WARN_SEC` anuncia que es la última pregunta; marca
  `done` tras la pregunta 8. El plan y el transcript entran con
  `untrustedBlock` y cada mensaje del candidato en una sola línea (sin saltos).
- Exportar desde `prompts/index.ts`.

Done when: `interview-turn.spec.ts` verifica con snapshots el prompt del
primer turno, uno a mitad y uno con `activeSec = 560`; que un texto con
"\nINTERVIEWER:" no crea una línea falsa; y `schemas.spec.ts` que
`InterviewTurnOutput` conserva `reply` con 8 correcciones (corta a 6) o una
inválida.

- **Model**: claude/opus
- **Estimate**: 4h
- **Reason**: Diseño de prompt con reglas de rol, tiempo e inyección.
- **Dependencies**: F10.1.T2
- **Files**:
  - `apps/api/src/llm/prompts/interview-turn.ts`
  - `apps/api/src/llm/prompts/interview-turn.spec.ts`
  - `apps/api/src/llm/prompts/index.ts`
  - `apps/api/src/llm/schemas.ts`
  - `apps/api/src/llm/schemas.spec.ts`

### F12.1.T2 — Sesión de entrevista: abrir, turnos, tiempo y cierre

Integrar la entrevista al pipeline de sesiones (C4, D3–D5):
- `POST /interviews/:id/session`: con la entrevista en `ready` crea una sesión
  `kind = 'interview'`, `topic = 'Entrevista'`, `interview_id`, y pasa la
  entrevista a `in_progress`; si ya está `in_progress` devuelve la misma sesión
  y el progreso (retomar, FR-25). Otros estados → 409.
- `scenario.ts`: `interviewScenario` construido desde el plan;
  `rebuildScenario` lo usa para `kind = 'interview'`.
- `TurnsService` para `kind = 'interview'`: usa `buildInterviewTurnMessages`
  e `InterviewTurnOutput` con purpose `interview` y el combo del plan del
  usuario (D7); consume el tope diario de turnos como siempre; suma a
  `sessions.active_sec` `min(gap, 120)` segundos desde el turno anterior (D4);
  impone en el servicio la regla de una repregunta por pregunta; actualiza
  `interviews.answered_count`; guarda las correcciones pero no las envía
  (ni en `TurnResultDto` ni en el evento SSE `corrections`, FR-10); agrega
  `interview: { questionIdx, totalQuestions, competency, remainingSec, done }`
  al `TurnResultDto`.
- Con `done` del modelo o `active_sec >= INTERVIEW_MAX_SEC` cierra la sesión
  con el flujo normal (`SessionCloserService`) y pasa la entrevista a
  `feedback_pending` si `answered_count >= 4` o a `too_short` si no; en
  `too_short` el usuario puede retomar (vuelve a `in_progress` con
  `POST /interviews/:id/session`).
- `POST /sessions/:id/end` sobre una sesión `interview` aplica la misma regla
  (FR-11).
- Sweeper: las sesiones `interview` se abandonan a
  `INTERVIEW_ABANDON_AFTER_SEC` (24 h), no a los 30 min.
- El encolado del parecer es un hook `onInterviewSessionClosed(interviewId)`
  que por ahora solo registra un log; F12.3.T1 lo conecta al job.

Done when: specs cubren abrir y retomar, `active_sec` que no cuenta una pausa
de 10 min, cierre a 600 s, cierre con 3 respuestas → `too_short`, que la
respuesta SSE de un turno de entrevista no incluye correcciones, que una
segunda repregunta a la misma pregunta se evita, y que el sweeper no abandona
una entrevista de 2 h.

- **Model**: claude/opus
- **Estimate**: 7h
- **Reason**: Toca el núcleo de turnos y sesiones con reglas de tiempo y estado; premium por el riesgo de regresión.
- **Dependencies**: F12.1.T1, F10.3.T2
- **Files**:
  - `apps/api/src/sessions/scenario.ts`
  - `apps/api/src/sessions/turns.service.ts`
  - `apps/api/src/sessions/sessions.types.ts`
  - `apps/api/src/sessions/turn-stream.ts`
  - `apps/api/src/sessions/session-sweeper.service.ts`
  - `apps/api/src/sessions/session-sweeper.repository.ts`
  - `apps/api/src/sessions/end-session.service.ts`
  - `apps/api/src/sessions/`
  - `apps/api/src/interviews/interviews.controller.ts`
  - `apps/api/src/interviews/interviews.service.ts`
  - `apps/api/src/interviews/interview-session.service.ts`

## F12.2 — Package: parecer en el agente

### F12.2.T1 — /v1/feedback en interview-agent

Implementar `POST /v1/feedback` según I1 (`app/feedback/`):
- agente con `response_model` del contrato que evalúa cada competencia de la
  rúbrica: nivel observado vs. esperado en la escala de seniority, `evidence`
  como cita literal del candidato, qué faltó y qué estudiar;
- puede usar DuckDuckGo (máx. 3 búsquedas) para verificar una afirmación
  técnica antes de marcarla como incorrecta y entonces pone `verified: true`
  (FR-15);
- sección de inglés: claridad, vocabulario y errores con corrección y
  explicación, a partir de `englishErrors` y del transcript; no reporta como
  error lo que probablemente sea un error de transcripción (FR-35);
- `summary` de 2–3 frases dirigido a `learnerName`, con una fortaleza y un
  foco (FR-27); tono de parecer, nunca de veredicto (FR-13); textos en
  `locale`;
- si viene `previousFeedback`, `comparison` por competencia con
  `trend` (FR-19, FR-30);
- `studyPlan` de exactamente 5 sesiones enfocadas en las competencias más
  débiles e incluyendo al menos una de inglés; con `previousFeedback`, lo que
  retrocedió entra al plan.

Si una `evidence` no es subcadena de una línea del candidato, reintentar una
vez; si persiste, quitar esa competencia del resultado.

Done when: tests con modelo simulado cubren evidencia inventada → reintento,
"cash" en contexto de cache → no aparece como error, un parecer que incluye
"you would be hired" o "rechazado" → rechazado por un validador de
expresiones prohibidas (es, pt, en), `comparison` presente solo con
`previousFeedback`, y `studyPlan` con 5 items.

- **Model**: claude/opus
- **Estimate**: 6h
- **Reason**: Evaluación con verificación y validaciones de tono; tier premium.
- **Dependencies**: F10.2.T2
- **Files**:
  - `apps/interview-agent/app/feedback/`
  - `apps/interview-agent/app/main.py`
  - `apps/interview-agent/tests/`

## F12.3 — Package: job del parecer

### F12.3.T1 — Job interview-feedback, memoria y endpoint del parecer

- Conectar `onInterviewSessionClosed` (F12.1.T2) a `enqueueInterviewFeedback`
  en `JobDispatcher` cuando la entrevista queda en `feedback_pending`.
- Job `interview-feedback` en `apps/api/src/jobs/interviews/`: arma el request
  de I1 (plan, transcript de la sesión con `questionIdx`, correcciones
  guardadas como `englishErrors`, `locale` y nombre del perfil,
  `previousFeedback` si hay `parent_interview_id`); verifica que cada
  `evidence` sea subcadena de una respuesta del candidato y descarta las que
  no; guarda `feedback`, estado `feedback_ready`; registra uso en `llm_calls`
  (`interview_feedback`); push `notifyInterviewFeedbackReady`. Error tras el
  reintento → `feedback_failed` y push no se envía.
- Memoria (D6): un hecho `pending` "Se prepara para una entrevista de {rol} en
  {empresa}" (≤160 caracteres, no duplicar si ya existe para la misma
  oferta), y los errores de inglés del parecer sumados a `recurring_errors`
  del brief del usuario (máx. 5, sin duplicar), por el repositorio de memoria.
- `GET /interviews/:id/feedback`: el parecer; `409 TOO_SHORT` con
  `answeredCount` si la entrevista está en `too_short`; `202` con estado si
  está `feedback_pending`. `POST /interviews/:id/retry` también acepta
  `feedback_failed` y re-encola el parecer.

Done when: specs con cliente y push falsos cubren parecer guardado con una
evidencia inventada descartada, hecho de memoria creado una sola vez,
`recurring_errors` sin duplicados, `feedback_failed` tras error y el endpoint
en sus tres estados.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: Orquestación sobre contratos ya fijados.
- **Dependencies**: F12.1.T2, F12.2.T1, F10.3.T3
- **Files**:
  - `apps/api/src/jobs/interviews/`
  - `apps/api/src/jobs/job-dispatcher.ts`
  - `apps/api/src/interviews/interviews.controller.ts`
  - `apps/api/src/interviews/interviews.service.ts`
  - `apps/api/src/interviews/interview-session.service.ts`
  - `apps/api/src/memory/memory.repository.ts`
  - `apps/api/src/memory/memory.service.ts`

## F12.4 — Package: app, entrevista y parecer

### F12.4.T1 — Modo entrevista en la conversación

En `conversation_screen.dart` agregar `ConversationMode.interview` (pantalla
IE-05), usado por la ruta `/interviews/:id/session`, que llama
`POST /interviews/:id/session` y abre la conversación con ese `sessionId`:
- la respuesta por voz se envía sin pantalla de revisión: al tocar el
  micrófono para terminar o al cortar el STT por silencio, se envía la
  transcripción y queda en el chat sin poder editarse (FR-34);
- sin chips de corrección; encabezado "Pregunta n de 8" y la competencia
  actual, desde `TurnResultDto.interview`; aviso "Modo entrevista · sin
  correcciones";
- ayudas existentes: repetir la pregunta (TTS de nuevo), Translate y Say it
  slower (FR-24); campo "O escribe tu respuesta…" (FR-9);
- botón Terminar con confirmación; al terminar o con `interview.done`,
  navegar a `/interviews/:id/feedback`.
El modo normal de las sesiones no cambia (sigue con revisión).

Contrato de sesión de entrevista ya implementado en la API (PR #94):
- `POST /interviews/:id/session` abre o retoma **la misma** sesión; al retomar,
  el primer turno es "Welcome back, … <pregunta pendiente>" y el progreso no
  avanza. Responde `409 INTERVIEW_NOT_RESUMABLE` si la entrevista se cerró
  por tiempo o por abandono, y `409 SESSION_ALREADY_ACTIVE` (con
  `extra.activeSessionId`) si hay una sesión normal abierta: mostrar un aviso
  para terminarla primero.
- Terminar antes de 4 respuestas deja la entrevista en `too_short` con la
  sesión pausada; los turnos mientras está pausada responden
  `409 SESSION_NOT_ACTIVE`, así que la app debe llamar primero a
  `POST /interviews/:id/session`.
- Un turno con `interview.done` puede dejar la entrevista en `too_short` o
  `feedback_pending`: tras `done`, leer `GET /interviews/:id` para decidir si
  ir al parecer o a IE-06d.
- Mapear `INTERVIEW_NOT_RESUMABLE` e `INTERVIEW_NOT_RETRYABLE` en
  `ApiErrorCode` con textos es (tuteo) y pt.

Done when: widget tests verifican que en modo entrevista una transcripción se
envía sin revisión y no aparecen chips, que en modo normal sigue la revisión,
y la navegación al parecer con `done`.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: Cambio acotado en una pantalla existente con buenas pruebas.
- **Dependencies**: F11.2.T3
- **Files**:
  - `apps/mobile/lib/features/session/presentation/conversation_screen.dart`
  - `apps/mobile/lib/features/session/`
  - `apps/mobile/lib/features/interviews/presentation/session/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/session/`

### F12.4.T2 — Pantallas del parecer

Pantalla `/interviews/:id/feedback` (IE-06a a IE-06e):
- carga (IE-06c, "Armando tu parecer", con refresco cada 3 s mientras
  responde 202);
- resumen "Así te vi, {nombre}" y tarjetas por competencia con observado vs.
  esperado, cita, "Qué faltó", "Qué estudiar" y badge "Verificado" (IE-06a);
- "Tu inglés": claridad, vocabulario y errores con su corrección (IE-06b);
- aviso fijo "Parecer orientativo generado por IA. Es una guía para estudiar,
  no una evaluación oficial." (FR-14) y CTA "Empezar ciclo de estudio" (navega
  a `/interviews/:id/cycle`, F13.2);
- `409 TOO_SHORT` → IE-06d con "Retomar entrevista" (solo si
  `GET /interviews/:id` trae `resumable: true`) y "Empezar de nuevo" (crea una
  entrevista nueva con la misma oferta); con `resumable: false` solo se ofrece
  "Empezar de nuevo";
- `feedback_failed` o red → IE-06e con Reintentar y "Avísame cuando esté
  listo".
Sin botón de compartir.

Done when: widget tests con `FakeFluentApi` cubren los cinco estados y que no
existe acción de compartir.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: UI de lectura con estados definidos.
- **Dependencies**: F12.4.T1
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/feedback/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/feedback/`
