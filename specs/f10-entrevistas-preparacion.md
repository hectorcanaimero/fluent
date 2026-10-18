---
type: spec
project_id: fluent
phase: 10
version: 0.1
depends_on:
  - docs/arch/003-simulador-entrevistas.md
  - docs/prd/003-simulador-entrevistas.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-18
title: Simulador de entrevistas — contrato, datos y preparación
---

# F10 — Contrato, datos y servicio de preparación

Base del simulador de entrevistas: tablas y tipos, el servicio Python
`interview-agent` con Agno que prepara el plan, y el módulo `interviews` de la
API que crea entrevistas, aplica el tope diario y encola la preparación.

Arquitectura: `docs/arch/003-simulador-entrevistas.md`, secciones *Components*
(C1, C2, C3, C5), *Data model* e *Interfaces* (I1, I2, I4). Requisitos:
`docs/prd/003-simulador-entrevistas.md` (FR-1 a FR-7, FR-20 a FR-23, FR-32,
FR-33, NFR-1 a NFR-8). Todo texto para el usuario va en español neutro
latinoamericano con tuteo, nunca voseo, y en pt-BR.

## F10.1 — Package: datos y tipos

### F10.1.T1 — Migración del simulador de entrevistas

Crear `apps/api/migrations/<timestamp>_simulador-entrevistas.sql` con
exactamente lo que fija *Data model* de la arquitectura:
- tablas `interviews`, `interview_questions_asked`, `study_cycles`,
  `study_cycle_sessions` con sus CHECK e índices;
- en `sessions`: CHECK de `kind` con `interview` y `study` (conservando los
  valores existentes, incluido `group` si ya está en `main`), columnas
  `interview_id`, `study_cycle_session_id` (ambas `on delete set null`, con
  índice) y `active_sec int not null default 0`;
- CHECK de `llm_calls.purpose` con `interview`, `interview_prepare` e
  `interview_feedback` además de los actuales;
- RLS: el dueño (`auth.uid() = user_id`) puede leer sus filas de las 4 tablas
  nuevas; sin políticas de escritura (escribe la API con el cliente admin),
  igual que `sessions`. `study_cycle_sessions` se autoriza por el `user_id` del
  ciclo.

Leer antes las migraciones existentes y `scripts/run-sql-test.sh` para seguir
el mismo estilo (nombres de constraints, `create index`, comentarios en
español). No editar migraciones ya mergeadas.

Done when: `apps/api/migrations/tests/interviews.sql` verifica que un usuario
no ve entrevistas de otro, que `sessions.kind = 'interview'` es aceptado, que
`study_cycle_sessions.idx = 6` es rechazado y que borrar una entrevista deja en
null `sessions.interview_id`; la migración aplica limpia sobre un Postgres 16
con todas las anteriores.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: SQL con RLS y CHECKs siguiendo un patrón existente.
- **Dependencies**:
- **Files**:
  - `apps/api/migrations/`
  - `apps/api/migrations/tests/interviews.sql`

### F10.1.T2 — Tipos y contratos compartidos

Fijar en código los contratos de *Interfaces* I1, I2 e I4 para que el resto de
las tareas los consuma:

- `apps/api/src/interviews/interviews.types.ts`: schemas zod
  `PrepareRequest`, `PrepareResponse` (incluye la variante
  `offer_unreadable`), `FeedbackRequest`, `FeedbackResponse`, `InterviewPlan`
  (rubric + questions), `InterviewFeedback`, `StudyPlanItem`, los enums
  `InterviewType`, `InterviewStatus`, `PrepStep`, `SeniorityLevel`
  (`junior | semi_senior | senior | staff_lead`) y los invariantes de I1
  (4–6 competencias, 8 preguntas, cada competencia con ≥1 pregunta, `mixed`
  ⇒ 2 `behavioral`, `studyPlan` de 5) como `superRefine`.
- `apps/api/src/db/schema.ts`: `SessionKind` suma `interview` y `study`; el
  tipo de kinds que se pueden abrir con `POST /sessions` no los incluye.
- `apps/api/src/llm/config.ts`: `Purpose` suma `interview`,
  `interview_prepare`, `interview_feedback`.
- `apps/api/src/jobs/jobs.constants.ts`: cola `interviews` (concurrencia 3) y
  nombres de job `interview-prepare`, `interview-feedback`, `study-reminder`.
- `apps/api/src/config/env.ts`: variables de I4 con sus defaults
  (`INTERVIEW_AGENT_URL`, `INTERVIEW_AGENT_TOKEN`, `INTERVIEWS_DAILY_CAP=3`,
  `INTERVIEWS_REQUIRE_PRO=false`, `INTERVIEW_MAX_SEC=600`,
  `INTERVIEW_WARN_SEC=540`, `INTERVIEW_ABANDON_AFTER_SEC=86400`). Si
  `INTERVIEW_AGENT_URL` falta, la app arranca y el módulo responde 503.

Ajustar los `switch` exhaustivos que dejen de compilar con un caso que lance
error explícito (sin implementar la lógica de entrevistas).

Done when: `interviews.types.spec.ts` acepta un plan válido y rechaza uno con 7
preguntas, uno `mixed` con 1 conductual y un parecer con `studyPlan` de 4;
`pnpm --filter @fluent/api lint`, `test` y `build` pasan.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Tipos y validación; el contrato ya está escrito en la arquitectura.
- **Dependencies**:
- **Files**:
  - `apps/api/src/interviews/interviews.types.ts`
  - `apps/api/src/interviews/interviews.types.spec.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/llm/config.ts`
  - `apps/api/src/jobs/jobs.constants.ts`
  - `apps/api/src/config/env.ts`

## F10.2 — Package: interview-agent

### F10.2.T1 — Esqueleto del servicio interview-agent

Crear `apps/interview-agent/`, un servicio Python 3.12 con FastAPI y Agno,
gestionado con `uv` (`pyproject.toml` + `uv.lock`):

- `GET /healthz` → `{"ok": true}` sin auth.
- Dependencia de auth para `/v1/*`: `Authorization: Bearer
  <INTERVIEW_AGENT_TOKEN>` comparado con `hmac.compare_digest`; 401 si falta o
  no coincide.
- `app/contract.py`: modelos Pydantic idénticos a I1 de la arquitectura
  (request y response de `/v1/prepare` y `/v1/feedback`), con los mismos
  invariantes como validadores.
- `app/models.py`: fábrica de modelo Agno `OpenAILike` contra 9router
  (`NINEROUTER_URL`, `NINEROUTER_API_KEY`, `INTERVIEW_MODEL`, default
  `fluent-pro`).
- Endpoints `/v1/prepare` y `/v1/feedback` que por ahora responden 501.
- `Dockerfile` multi-stage (imagen slim, usuario no root, `uvicorn` en el
  puerto 8000, healthcheck a `/healthz`).
- Tests con `pytest` y `httpx` (auth 401/200, healthz, validación de los
  modelos del contrato); lint con `ruff`.
- En `.github/workflows/ci.yml`: filtro `interview_agent` en el job `changes`
  existente (`apps/interview-agent/**` y el workflow) y un job
  `interview-agent` que corre `uv sync`, `ruff check` y `pytest`.
- `docs/runbooks/despliegue.md`: sección para crear la app interna
  `fluent-interview-agent` en Coolify (build context `apps/interview-agent`,
  sin puerto público, misma red que `fluent-api` y `fluent-9router`,
  variables de I4).

Done when: `uv run pytest` y `uv run ruff check` pasan en
`apps/interview-agent`, `docker build apps/interview-agent` termina bien y el
job nuevo del CI corre en el PR.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Scaffolding de un servicio nuevo con contrato fijo; nivel estándar alcanza.
- **Dependencies**:
- **Files**:
  - `apps/interview-agent/`
  - `.github/workflows/ci.yml`
  - `docs/runbooks/despliegue.md`

### F10.2.T2 — Workflow de preparación /v1/prepare

Implementar `POST /v1/prepare` con un Workflow de Agno de dos pasos
(arquitectura C1 e I1):

1. **Investigador** (`app/prepare/researcher.py`):
   - si viene `offerUrl`: rechazar sin descargar hosts de LinkedIn
     (`linkedin.com`, `lnkd.in`) con `offer_unreadable` / `linkedin`; si no,
     descargar con `httpx` (timeout 15 s, máx. 2 MB, solo http/https, sin IPs
     privadas ni `localhost`) y extraer el texto principal; vacío, 4xx o pared
     de login → `offer_unreadable` con su `reason`;
   - buscar empresa y rol con la tool DuckDuckGo de Agno (máx. 3 búsquedas,
     20 s en total); si falla o no encuentra nada, seguir con
     `research.found = false` (NFR-6);
   - solo datos de la oferta van a la búsqueda, nunca datos del usuario (NFR-5).
2. **Diseñador** (`app/prepare/designer.py`): agente con `response_model`
   Pydantic que devuelve empresa, rol, área, seniority, stack, rúbrica de 4–6
   competencias y 8 preguntas en inglés, cortas y propias del área (cualquier
   área, sin banco fijo), con dificultad según seniority (concepto y práctica
   en junior; diseño, trade-offs y liderazgo en senior/staff), 2 conductuales
   en `mixed`, sin repetir `previousQuestions`.

La oferta y la investigación entran al prompt delimitadas como datos no
confiables (el modelo no sigue instrucciones que vengan de ellas). Si la salida
no cumple los invariantes, un reintento con el error de validación; si vuelve
a fallar, 502. `usage` suma tokens de ambos pasos y la cantidad de búsquedas.

Done when: tests con el modelo y la búsqueda simulados cubren: URL de
LinkedIn → `offer_unreadable` sin request HTTP; URL a `127.0.0.1` rechazada;
búsqueda que falla → plan con `research.found=false`; plan inválido →
reintento; y 5 ofertas fijas (frontend, datos, producto, ventas, enfermería)
cuyo plan pasa los invariantes y nombra competencias del área. Un test marcado
`live` (no corre en CI) llama a 9router de verdad con una oferta.

- **Model**: claude/opus
- **Estimate**: 6h
- **Reason**: Diseño de prompts y del flujo con herramientas, seguridad de fetch (SSRF) e inyección; conviene el tier premium.
- **Dependencies**: F10.2.T1
- **Files**:
  - `apps/interview-agent/app/prepare/`
  - `apps/interview-agent/app/main.py`
  - `apps/interview-agent/tests/`

## F10.3 — Package: módulo interviews y preparación

### F10.3.T1 — Push de entrevistas y ciclo

En el módulo `push` (arquitectura C5):
- `PushKind` suma `interview_ready`, `interview_prep_failed`,
  `interview_feedback_ready`, `study_reminder`.
- `push.messages.ts`: textos es (tuteo) y pt-BR de FR-32 del PRD, con
  `data.route` `/interviews/:id`, `/interviews/:id` (prep fallida),
  `/interviews/:id/feedback` y `/interviews/:id/cycle`. Solo empresa y rol en
  el texto, nunca contenido del parecer.
- `PushService`: `notifyInterviewReady(userId, interviewId, role, company)`,
  `notifyInterviewPrepFailed(userId, interviewId, company)`,
  `notifyInterviewFeedbackReady(userId, interviewId, company)`,
  `notifyStudyReminder(userId, interviewId, n, title)`; todos con `safely()`
  como los existentes.

Done when: `push.service.spec.ts` verifica los cuatro métodos en es y pt-BR
(título, cuerpo y `route`) y que un error de Firebase no se propaga.

- **Model**: claude/claude-haiku-4-5-20251001
- **Estimate**: 2h
- **Reason**: Extensión mecánica de un patrón existente.
- **Dependencies**:
- **Files**:
  - `apps/api/src/push/push.messages.ts`
  - `apps/api/src/push/push.service.ts`
  - `apps/api/src/push/push.service.spec.ts`

### F10.3.T2 — Endpoints de entrevistas: cuota, crear, consultar, reintentar

Crear el módulo `apps/api/src/interviews/` (controller, service, repository,
DTOs) con las rutas de I2: `GET /interviews/quota`, `POST /interviews`,
`GET /interviews`, `GET /interviews/:id`, `POST /interviews/:id/retry`.

- `POST /interviews`: valida `type` y que venga exactamente uno de
  `offerText` (≤ 20000 caracteres) u `offerUrl` (http/https); si el host es
  LinkedIn responde `422 OFFER_UNREADABLE` sin consumir tope (D8); calcula
  `offer_hash`; aplica el tope diario con un contador Redis
  `interviews:day:{userId}:{userDay}` (mismo patrón que `turns:day`,
  `INTERVIEWS_DAILY_CAP`, `429 INTERVIEWS_DAILY_CAP` con `retryAfter`); si
  `INTERVIEWS_REQUIRE_PRO` es true y el plan efectivo es free, `403
  PLAN_REQUIRED`; inserta en `preparing` / `reading` y encola
  `interview-prepare` con un método nuevo `enqueueInterviewPrepare` en
  `JobDispatcher`.
- `GET /interviews/quota`: `{ remaining, limit, requiresPro, freeNotice: true }`.
- `GET /interviews/:id`: estado, `prepStep`, ficha y competencias por nombre;
  **nunca** las preguntas del plan (FR-7). 404 si no es del usuario.
- `GET /interviews`: lista del usuario, más nueva primero, con `status`
  mapeado a los estados de la pantalla de historial (FR-31).
- `POST /interviews/:id/retry`: solo desde `prep_failed`; vuelve a encolar sin
  consumir tope (NFR-6).
- Si `INTERVIEW_AGENT_URL` no está configurada, `POST` responde 503.

Done when: `interviews.controller.spec.ts` / `interviews.service.spec.ts`
cubren LinkedIn → 422 sin consumir tope, tope → 429, `retry` no consume tope,
el detalle no contiene `questions` y otro usuario recibe 404.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: CRUD con reglas de negocio claras sobre patrones existentes.
- **Dependencies**: F10.1.T1, F10.1.T2
- **Files**:
  - `apps/api/src/interviews/interviews.controller.ts`
  - `apps/api/src/interviews/interviews.service.ts`
  - `apps/api/src/interviews/interviews.repository.ts`
  - `apps/api/src/interviews/interviews.module.ts`
  - `apps/api/src/interviews/dto/`
  - `apps/api/src/interviews/interviews.controller.spec.ts`
  - `apps/api/src/interviews/interviews.service.spec.ts`
  - `apps/api/src/jobs/job-dispatcher.ts`
  - `apps/api/src/app.module.ts`

### F10.3.T3 — Cliente del agente y job interview-prepare

- `apps/api/src/interviews/interview-agent.client.ts`: `InterviewAgentClient`
  con `prepare(req)` y `feedback(req)` sobre `fetch`, bearer
  `INTERVIEW_AGENT_TOKEN`, timeout 120 s, valida la respuesta con los schemas
  zod de F10.1.T2 y lanza errores tipados (`AgentUnavailable`,
  `AgentInvalidResponse`).
- `apps/api/src/jobs/interviews/`: módulo con `@Processor` de la cola
  `interviews` (registrado en `jobs.module.ts`) que en `interview-prepare`:
  1. pone `prep_step` en `researching` y luego `designing` (para IE-03);
  2. arma el request con la oferta, el nivel del perfil y las últimas 50
     preguntas de `interview_questions_asked` del mismo `offer_hash` o área;
  3. con `offer_unreadable` → `prep_failed`, `error_code`, push
     `notifyInterviewPrepFailed`, y devuelve el consumo del tope del día;
  4. con éxito → guarda empresa, rol, área, seniority y `plan`, estado
     `ready`, `prep_step = done`, inserta las 8 preguntas en
     `interview_questions_asked`, registra uso en `llm_calls` con purpose
     `interview_prepare` y manda `notifyInterviewReady`;
  5. error del agente → 1 reintento de BullMQ con backoff; al agotarse,
     `prep_failed` y push de fallo, sin consumir tope.

Done when: specs con un cliente HTTP y un PushService falsos cubren éxito,
`offer_unreadable`, respuesta inválida del agente y agente caído tras el
reintento, verificando estado final, push enviada y tope.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: Job con reintentos y estados sobre el patrón de coaching-brief.
- **Dependencies**: F10.1.T1, F10.1.T2, F10.3.T1
- **Files**:
  - `apps/api/src/interviews/interview-agent.client.ts`
  - `apps/api/src/interviews/interview-agent.client.spec.ts`
  - `apps/api/src/jobs/interviews/`
  - `apps/api/src/jobs/jobs.module.ts`
