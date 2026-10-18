---
type: arch
project_id: fluent
version: 0.1
depends_on:
  - docs/prd/003-simulador-entrevistas.md
  - docs/arch/001-9router-y-planes.md
  - docs/arch/002-sesion-grupal.md
generated_by: orch-arch
generated_at: 2026-10-18
title: Simulador de entrevistas técnicas — arquitectura
---

# Simulador de entrevistas técnicas — arquitectura

## Context

Hoy Fluent tiene sesiones 1 a 1 (`sessions`, kinds `free_topic | roleplay |
news | boss`) con turnos por SSE (`POST sessions/:id/turns/stream`), un único
cliente LLM (`LlmService.complete`) que habla con 9router, memoria (`facts`,
`coaching_briefs`), push por Firebase (`PushService`), colas BullMQ en un worker
NestJS y la app Flutter con `conversation_screen.dart`. No hay servicios en
Python ni llamadas HTTP a servicios propios.

El PRD 003 agrega un simulador de entrevistas: preparar un plan a partir de una
oferta (con investigación web), conducir 8 preguntas en hasta 10 minutos, dar un
parecer técnico y de inglés, y armar un ciclo de 5 sesiones con re-entrevista.
La preparación y el parecer van a un servicio nuevo en Python con Agno; todo lo
demás reutiliza el pipeline de sesiones existente.

## Components

### C1 — `interview-agent` (Python, Agno, FastAPI) — nuevo

- **Responsabilidad:** dos operaciones sin estado: preparar el plan de una
  entrevista y producir el parecer. No guarda nada ni conoce usuarios: recibe
  todo el contexto en el request y devuelve JSON validado.
- **Preparación** (`POST /v1/prepare`): Workflow Agno de 2 pasos.
  1. *Investigador*: si viene `offerUrl`, la descarga y extrae el texto; si es
     LinkedIn o no se puede leer, devuelve `offer_unreadable` sin seguir.
     Busca la empresa y el rol con DuckDuckGo (tool de Agno) y resume hallazgos.
  2. *Diseñador*: con la oferta y la investigación determina empresa, área,
     seniority, stack, rúbrica de 4–6 competencias y 8 preguntas (2
     conductuales en tipo `mixed`), evitando `previousQuestions`.
- **Parecer** (`POST /v1/feedback`): un agente con la rúbrica, el transcript,
  los errores de inglés registrados y, si es re-entrevista, el parecer
  anterior. Puede usar DuckDuckGo para verificar una afirmación técnica antes de
  marcarla como incorrecta. Devuelve el parecer, la comparación (si aplica) y
  el ciclo de estudio de 5 sesiones.
- **Modelos:** `OpenAILike` contra 9router (`NINEROUTER_URL`,
  `NINEROUTER_API_KEY`), siempre con el combo `fluent-pro` (NFR-2). Salida
  estructurada con modelos Pydantic (`response_model`).
- **Auth:** `Authorization: Bearer ${INTERVIEW_AGENT_TOKEN}`, comparado en
  tiempo constante. Solo accesible en la red interna de Coolify.
- **Ubicación:** `apps/interview-agent/` (Python 3.12, `uv`, Dockerfile propio).

### C2 — Módulo `interviews` (NestJS API) — nuevo

- **Responsabilidad:** ciclo de vida de una entrevista y su API para la app.
  Dueño de las tablas `interviews`, `interview_questions_asked`, `study_cycles`
  y `study_cycle_sessions`.
- Crea la entrevista: valida entrada, detecta URLs de LinkedIn antes de llamar
  al agente (FR-2), aplica el tope diario (FR-21, NFR-3, NFR-8) y encola
  `interview-prepare`.
- Abre la sesión de la entrevista (kind `interview`) reusando
  `SessionsService.openSession`, y al terminar encola `interview-feedback`.
- Expone el historial, el parecer, el ciclo y la comparación.

### C3 — Jobs `interview-prepare` e `interview-feedback` (worker NestJS) — nuevo

- Cola nueva `interviews` (concurrencia 3) con dos jobs. Cada job llama a C1
  con `InterviewAgentClient` (HTTP, timeout 120 s, 1 reintento con backoff),
  valida la respuesta con zod (doble validación con Pydantic del otro lado),
  persiste y manda la push correspondiente.
- `interview-prepare`: avanza `prep_step` (para la pantalla de progreso),
  guarda el plan, registra las preguntas en `interview_questions_asked`.
- `interview-feedback`: guarda parecer y ciclo, escribe en memoria (D6),
  registra uso en `llm_calls`.
- Un cron diario `study-reminder` en la cola `maintenance` manda el
  recordatorio del ciclo (FR-32).

### C4 — Turnos de entrevista (sesiones existentes) — extensión

- `SessionKind` suma `interview` y `study`. Un turno de `interview` pasa por
  `TurnsService` igual que hoy (tope diario de turnos, lock, SSE, `record_turn`),
  pero `rebuildScenario` arma un `interviewScenario` desde el plan y el prompt
  es `buildInterviewTurnMessages` con el schema `InterviewTurnOutput`.
- Correcciones: se guardan en `corrections` como siempre pero **no** se envían
  a la app en `TurnResultDto` ni en el evento SSE `corrections` (FR-10).
- Tiempo: `active_sec` de la entrevista suma por turno `min(gap, 120 s)`, así
  las pausas no cuentan (FR-11b). A 540 s el prompt avisa "última pregunta";
  a 600 s o con la pregunta 8 respondida el turno devuelve `done` y la API cierra
  la sesión.
- El sweeper no abandona sesiones `interview` a los 30 min sino a las 24 h
  (`INTERVIEW_ABANDON_AFTER_SEC`), para permitir retomar (FR-25).
- Sesiones `study`: `rebuildScenario` arma `studyScenario` desde la fila de
  `study_cycle_sessions` (foco, título, formato guiado o roleplay) y usa el
  prompt de turno normal con un bloque de foco. Son sesiones normales: suman XP,
  racha y resumen semanal.

### C5 — Push (extensión)

- `PushKind` suma `interview_ready`, `interview_prep_failed`,
  `interview_feedback_ready`, `study_reminder` con textos es (tuteo) y pt-BR en
  `push.messages.ts` (FR-32, NFR-7). `data.route` lleva a `/interviews/:id`,
  `/interviews/:id/feedback` o `/interviews/:id/cycle`.
- La app cambia la lista blanca exacta de rutas por patrones que incluyan
  `/interviews/...`.

### C6 — App Flutter, feature `interviews` — nuevo

- `lib/features/interviews/`: pantallas IE-01 a IE-09 del diseño
  (`docs/design/fluentv3.pen`), repositorio y modelos. Entrada desde la pestaña
  Practicar (`new_session_screen.dart` suma una tarjeta).
- La entrevista reutiliza `conversation_screen.dart` con un modo
  `ConversationMode.interview`: sin pantalla de revisión (FR-34), sin chips,
  encabezado "Pregunta n de 8" + competencia, botón Terminar, y las ayudas
  existentes (repetir, traducir, más lento — FR-24).
- `FluentApi` suma los métodos de C2; `FakeFluentApi` también.

## Data model

Migración `apps/api/migrations/2026102xxxxxxx_simulador-entrevistas.sql`:

```sql
-- sessions: kinds nuevos y vínculo con la entrevista / sesión del ciclo
alter table sessions drop constraint sessions_kind_check;
alter table sessions add constraint sessions_kind_check
  check (kind in ('free_topic','roleplay','news','boss','group','interview','study'));
alter table sessions add column interview_id uuid references interviews(id) on delete set null;
alter table sessions add column study_cycle_session_id uuid references study_cycle_sessions(id) on delete set null;
alter table sessions add column active_sec int not null default 0;

create table interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_interview_id uuid references interviews(id) on delete set null, -- re-entrevista
  type text not null check (type in ('technical','mixed')),
  offer_text text check (char_length(offer_text) <= 20000),
  offer_url text,
  offer_hash text not null,                 -- sha256 del texto normalizado o de la URL
  status text not null check (status in (
    'preparing','prep_failed','ready','in_progress','too_short',
    'feedback_pending','feedback_ready','feedback_failed')),
  prep_step text check (prep_step in ('reading','researching','designing','done')),
  company jsonb,                            -- {name, industry?, city?, workMode?}
  role text, area text, seniority text,
  plan jsonb,                               -- InterviewPlan (sin exponer preguntas a la app)
  feedback jsonb,                           -- InterviewFeedback
  error_code text,
  answered_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interviews_user_created_idx on interviews(user_id, created_at desc);

create table interview_questions_asked (
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_hash text not null,
  area text not null,
  question text not null,
  created_at timestamptz not null default now()
);
create index interview_questions_user_idx on interview_questions_asked(user_id, offer_hash);

create table study_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  status text not null check (status in ('active','completed','skipped')),
  created_at timestamptz not null default now()
);
create table study_cycle_sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references study_cycles(id) on delete cascade,
  idx smallint not null check (idx between 1 and 5),
  focus text not null,                      -- competencia o 'english'
  title text not null,
  format text not null check (format in ('guided','roleplay')),
  est_min smallint not null,
  brief text not null,                      -- qué practicar, para el prompt
  done_at timestamptz,
  unique (cycle_id, idx)
);
```

- RLS: el dueño lee sus filas; escribe solo la API con el cliente admin, como
  en `sessions`.
- `llm_calls.purpose` suma `interview`, `interview_prepare`,
  `interview_feedback` (el CHECK cambia en la misma migración).
- `sessions.topic` de una entrevista es la constante `"Entrevista"` y de una
  sesión del ciclo, su `title`: el resumen semanal lee `topic` y no debe
  mostrar empresa ni rol (NFR-5).

## Interfaces

### I1 — C2/C3 → C1 (`interview-agent`)

`POST /v1/prepare`, `Authorization: Bearer <INTERVIEW_AGENT_TOKEN>`:

```jsonc
// request
{ "interviewId": "uuid", "type": "technical|mixed",
  "offerText": "string|null", "offerUrl": "string|null",
  "learnerLevel": "A2|B1|B2", "previousQuestions": ["string"] }
// response 200
{ "status": "ok", "type": "technical|mixed" /* eco del request */,
  "research": { "found": true, "notes": "string" },
  "company": { "name": "string", "industry": "string?", "city": "string?", "workMode": "string?" },
  "role": "string", "area": "string", "seniority": "junior|semi_senior|senior|staff_lead",
  "stack": ["string"],
  "rubric": [ { "id": "c1", "name": "string", "expectedLevel": "junior|semi_senior|senior|staff_lead", "weight": 1 } ],
  "questions": [ { "idx": 1, "competencyId": "c1", "kind": "technical|behavioral", "text": "string (en inglés)" } ],
  "usage": { "model": "string", "inputTokens": 0, "outputTokens": 0, "searchCalls": 0 } }
// response 200, oferta ilegible
{ "status": "offer_unreadable", "reason": "linkedin|login|not_found|empty" }
```

Invariantes: 4–6 competencias; exactamente 8 preguntas; toda competencia con ≥1
pregunta; toda `competencyId` existe en la rúbrica; `idx` únicos y exactamente
1..8; `type: mixed` ⇒ exactamente 2 `behavioral`.

`POST /v1/feedback`:

```jsonc
// request
{ "interviewId": "uuid", "locale": "es|pt-BR", "learnerName": "string",
  "plan": { /* rubric + questions de /v1/prepare */ },
  "transcript": [ { "role": "interviewer|candidate", "questionIdx": 1, "text": "string" } ],
  "englishErrors": [ { "original": "string", "corrected": "string", "category": "string" } ],
  "previousFeedback": { /* InterviewFeedback anterior */ } | null }
// response 200
{ "summary": "string (2–3 frases, al usuario por su nombre)",
  "competencies": [ { "competencyId": "c1", "observedLevel": "…", "expectedLevel": "…",
      "evidence": "cita literal del candidato", "missing": "string", "study": "string",
      "verified": false } ],
  "english": { "clarity": { "rating": "very_good|good|fair|needs_work", "note": "string" },
      "vocabulary": { "rating": "…", "note": "string" },
      "errors": [ { "original": "string", "corrected": "string", "explanation": "string" } ] },
  "comparison": [ { "competencyId": "c1", "before": "…", "after": "…", "trend": "up|same|down" } ] | null,
  "studyPlan": [ { "idx": 1, "focus": "c2|english", "title": "string", "format": "guided|roleplay",
      "estMin": 12, "brief": "string" } ],
  "usage": { /* igual que prepare */ } }
```

Invariantes: cada `evidence` es una subcadena de algún texto `candidate` del
transcript (C3 lo verifica y descarta la competencia si no); `studyPlan` tiene
exactamente 5 items; textos en `locale`, sin expresiones de contratación o
rechazo (FR-13); errores probables de STT no se reportan (FR-35). Errores: 401
token inválido, 422 request inválido, 502 si 9router falla tras reintentos.

### I2 — App → API (C2)

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/interviews/quota` | `{ remaining, limit, requiresPro:false, freeNotice:true }` (FR-21, FR-33) |
| `POST` | `/interviews` | `{ type, offerText?, offerUrl? }` → `201 InterviewDto` en `preparing`; `422 OFFER_UNREADABLE` si es LinkedIn; `429 INTERVIEWS_DAILY_CAP` |
| `GET` | `/interviews` | historial (FR-31), por mes |
| `GET` | `/interviews/:id` | estado, `prepStep`, ficha (empresa, rol, área, seniority, tipo, `questionCount`, `estimatedMin`, competencias por nombre) — nunca las preguntas (FR-7) |
| `POST` | `/interviews/:id/retry` | reintenta una preparación o parecer fallido (no consume tope) |
| `POST` | `/interviews/:id/session` | abre o retoma la sesión `interview`; devuelve `sessionId` y progreso |
| `GET` | `/interviews/:id/feedback` | parecer (FR-12, FR-26, FR-27); `409 TOO_SHORT` si < 4 respuestas |
| `POST` | `/interviews/:id/cycle` | crea el ciclo desde `studyPlan` |
| `GET` | `/interviews/:id/cycle` | sesiones del ciclo con estado bloqueada/disponible/hecha |
| `POST` | `/interviews/:id/cycle/sessions/:idx/start` | abre una sesión `study` (409 si la anterior no está hecha) |
| `POST` | `/interviews/:id/reinterview` | crea una entrevista hija con la misma oferta (requiere ciclo completo) |

Los turnos siguen en `POST sessions/:id/turns/stream`. Para `kind = interview`
el `TurnResultDto` suma `interview: { questionIdx, totalQuestions, competency,
remainingSec, done }` y omite `corrections`.

### I3 — Turno de entrevista

```ts
// apps/api/src/llm/schemas.ts
export const InterviewTurnOutput = z.object({
  reply: z.string().max(600),            // 1–2 frases del entrevistador
  questionIdx: z.number().int().min(1).max(8),
  isFollowUp: z.boolean(),               // máx. 1 por pregunta, lo impone el servicio
  done: z.boolean(),
  corrections: keepValid(Correction, 6), // ocultas para la app
});
// apps/api/src/llm/prompts/interview-turn.ts
export function buildInterviewTurnMessages(input: {
  plan: InterviewPlan; transcript: InterviewTranscriptLine[];
  answeredCount: number; followUpUsedFor: number[]; activeSec: number; locale: Locale;
}): ModelMessage[];
```

### I4 — Configuración

API/worker: `INTERVIEW_AGENT_URL`, `INTERVIEW_AGENT_TOKEN`,
`INTERVIEWS_DAILY_CAP` (3), `INTERVIEWS_REQUIRE_PRO` (false),
`INTERVIEW_MAX_SEC` (600), `INTERVIEW_WARN_SEC` (540),
`INTERVIEW_ABANDON_AFTER_SEC` (86400). Agente: `NINEROUTER_URL`,
`NINEROUTER_API_KEY`, `INTERVIEW_AGENT_TOKEN`, `INTERVIEW_MODEL` (`fluent-pro`).

## Decisions

- **D1 — Agente sin estado; Nest es dueño de todos los datos.** Chosen: C1
  recibe el contexto y devuelve JSON; C3 persiste y escribe memoria. Rejected:
  que Agno lea/escriba memoria por la API de Nest, porque suma auth de usuario
  entre servicios, una segunda escritura concurrente y reintentos no
  idempotentes, sin ganar nada (NFR-1).
- **D2 — Llamadas al agente desde jobs BullMQ, no desde el request HTTP.**
  Chosen: `interview-prepare`/`interview-feedback` en el worker. Rejected:
  llamada síncrona desde el controller, porque la preparación tarda hasta 90 s
  y la app debe poder salir (FR-6); la cola ya da reintentos y progreso.
- **D3 — Turnos en el pipeline de sesiones existente.** Chosen: kinds nuevos
  `interview`/`study` en `sessions`. Rejected: sesiones propias del módulo
  `interviews`, porque duplicaría SSE, lock, tope de turnos, `record_turn`, XP,
  racha y resumen semanal (que ya cuenta `sessions` + `xp_events`).
- **D4 — Tiempo activo por turno, no reloj de pared.** Chosen: `active_sec +=
  min(gap, 120 s)`. Rejected: `now() - started_at`, porque retomar después de
  una pausa contaría la pausa (FR-11b, FR-25).
- **D5 — Retomar en la misma sesión.** Chosen: el sweeper abandona `interview`
  a las 24 h. Rejected: abrir una sesión nueva al retomar, porque partiría el
  transcript que el parecer cita.
- **D6 — Qué va a memoria.** Chosen: un hecho `pending` "Se prepara para una
  entrevista de {rol} en {empresa}" (con `happens_on` si el usuario la
  cargó) y los errores de inglés del parecer sumados a `recurring_errors` del
  brief; las debilidades técnicas viven en `study_cycle_sessions.brief` y entran
  al prompt de las sesiones `study`. Rejected: guardar cada debilidad como
  `fact`, porque los hechos son personales, de ≤160 caracteres y requieren
  confirmación.
- **D7 — Combo Pro para preparación y parecer, combo del plan para turnos.**
  Rejected: combo Free en preparación, porque la rúbrica y las preguntas de
  cualquier área piden un modelo fuerte; son 2 llamadas por entrevista (G3).
- **D8 — Detección de LinkedIn en Nest antes del agente.** Chosen: chequeo de
  host en C2 (respuesta inmediata) y además `offer_unreadable` en C1 para otros
  portales. Rejected: solo en C1, porque gastaría el tope y 30 s para un caso
  conocido.
- **D9 — Búsqueda web con DuckDuckGo (tool de Agno).** Rejected: Tavily/Exa
  por ahora, por costo; queda detrás de `INTERVIEW_SEARCH_PROVIDER` si la
  calidad no alcanza.

## Risks

- **Calidad del parecer técnico en áreas que el modelo conoce poco** (salud,
  derecho), *mitigation:* evidencia literal obligatoria y verificada por C3,
  aviso de IA (FR-14), banco de ofertas de 5 áreas en los tests del agente.
- **Latencia de preparación > 90 s** por búsqueda lenta, *mitigation:* timeout
  de 20 s por búsqueda y seguir sin investigación (NFR-6, pantalla IE-03a).
- **8 preguntas no entran en 10 min con revisión de texto,** *mitigation:* modo
  sin revisión (FR-34), repreguntas acotadas y cierre a 600 s con parecer de lo
  respondido; medir en beta cuántos llegan a la 8.
- **Prompt injection desde la oferta o la web** (una oferta que dice "ignorá
  las instrucciones"), *mitigation:* oferta e investigación entran como datos
  delimitados (`untrustedBlock` del lado Nest, delimitadores equivalentes en el
  agente) y la salida pasa por schema estricto.
- **Un servicio más que operar,** *mitigation:* healthcheck `GET /healthz`,
  app interna en Coolify sin puerto público, y degradación clara: si C1 no
  responde, la entrevista queda en `prep_failed` con reintento y sin consumir
  tope (NFR-6).

## Requirement coverage

| Requirement | Component(s) |
| --- | --- |
| FR-1 | C6 (IE-01), C2 `POST /interviews` |
| FR-2 | C2 (D8), C1 `offer_unreadable`, C6 (IE-02) |
| FR-3 | C1 Investigador |
| FR-4 | C1 Diseñador |
| FR-5 | C1 Diseñador, invariantes I1 |
| FR-6 | C3 `prep_step`, C5 push, C6 (IE-03) |
| FR-7 | C2 `GET /interviews/:id`, C6 (IE-04) |
| FR-8 | C4 `buildInterviewTurnMessages` |
| FR-9 | C6 modo entrevista, C4 |
| FR-10 | C4 (correcciones ocultas) |
| FR-11 | C4 `done`, C2 `409 TOO_SHORT`, C6 (IE-06d) |
| FR-11b | C4 `active_sec` (D4) |
| FR-12 | C1 `/v1/feedback`, C6 (IE-06a/b) |
| FR-13 | C1, test de expresiones prohibidas |
| FR-14 | C6 (IE-06b) |
| FR-15 | C1 búsqueda, campo `verified` |
| FR-16 | C2 `GET /interviews`, C6 (IE-09) |
| FR-17 | C1 `studyPlan`, C2 `POST /cycle`, C6 (IE-07) |
| FR-18 | C3 memoria (D6), C4 `studyScenario` |
| FR-19 | C2 `reinterview`, C1 `comparison`, C6 (IE-08) |
| FR-20 | `interview_questions_asked`, I1 `previousQuestions` |
| FR-21 | C2 `/quota` + tope, C6 (IE-01d) |
| FR-22 | C6 (borrador local del texto) |
| FR-23 | C1 `company`, C2, C6 (IE-04) |
| FR-24 | C6 (ayudas existentes de la conversación) |
| FR-25 | C4 sweeper 24 h (D5), C2 `POST /session` |
| FR-26 | I1 escala de seniority, C6 |
| FR-27 | C1 `summary` |
| FR-28 | Descartado |
| FR-29 | C2 desbloqueo en orden, C6 (IE-07) |
| FR-30 | C1 `comparison` + `studyPlan` con retrocesos |
| FR-31 | C2, C6 (IE-09) |
| FR-32 | C5, cron `study-reminder` |
| FR-33 | C2 `/quota.freeNotice`, C6 |
| FR-34 | C6 modo entrevista |
| FR-35 | C1 prompt del parecer |
| NFR-1 | C1 + C2/C3/C4, D1 |
| NFR-2 | C1 `INTERVIEW_MODEL`, C4 combo del plan (D7) |
| NFR-3 | C2 tope, C4 tope de turnos existente |
| NFR-4 | C3 timeouts, C4 SSE existente |
| NFR-5 | RLS, `sessions.topic` genérico, sin datos del usuario en búsquedas |
| NFR-6 | C3 reintentos, `prep_failed` sin consumir tope |
| NFR-7 | C1 `locale`, C5, C6 arb es (tuteo) / pt |
| NFR-8 | `INTERVIEWS_REQUIRE_PRO` |

## Work breakdown

Fases nuevas a partir de **F10** (F1–F9 ya existen en `specs/`).

### F10 — Contrato, datos y servicio de preparación

- **F10.1 — Migración y tipos**: migración de I1/Data model, `SessionKind`
  con `interview`/`study`, `Purpose` nuevos, tipos `InterviewPlan` /
  `InterviewFeedback` (zod) compartidos por C2/C3/C4. Files/dirs:
  `apps/api/migrations/`, `apps/api/migrations/tests/`,
  `apps/api/src/db/schema.ts`, `apps/api/src/llm/config.ts`,
  `apps/api/src/interviews/interviews.types.ts`.
- **F10.2 — Servicio `interview-agent`: esqueleto y `/v1/prepare`**: FastAPI,
  auth por token, Workflow Agno (Investigador + Diseñador), Pydantic de I1,
  tests con 5 ofertas de áreas distintas, Dockerfile y job de CI con filtro
  `apps/interview-agent/**`. No depende de F10.1 (el contrato está fijado en
  I1). Files/dirs: `apps/interview-agent/`, `.github/workflows/ci.yml`.
- **F10.3 — Módulo `interviews` (crear, consultar, cuota) y job
  `interview-prepare`**: controller y service de C2 para `quota`, `POST`,
  `GET` lista y detalle, `retry`; `InterviewAgentClient`; cola `interviews`;
  push `interview_ready`/`interview_prep_failed`. Depends on: F10.1.
  Files/dirs: `apps/api/src/interviews/`, `apps/api/src/jobs/interviews/`,
  `apps/api/src/jobs/jobs.constants.ts`, `apps/api/src/jobs/jobs.module.ts`,
  `apps/api/src/push/`, `apps/api/src/config/env.ts`.

### F11 — App: entrada, preparación y plan

- **F11.1 — Datos de entrevistas en la app**: modelos, `FluentApi` +
  `HttpFluentApi` + `FakeFluentApi`, repositorio y providers Riverpod. Depends
  on: F10.1 (contrato I2). Files/dirs: `apps/mobile/lib/core/api/`,
  `apps/mobile/lib/features/interviews/data/`.
- **F11.2 — Pantallas IE-01 a IE-04 e IE-09**: entrada (con borrador local,
  cuota y aviso gratis), URL no legible, preparando, resumen del plan,
  historial; rutas en `router.dart`; tarjeta en Practicar; push con rutas
  `/interviews/...`; textos arb es (tuteo) y pt. Depends on: F11.1.
  Files/dirs: `apps/mobile/lib/features/interviews/presentation/`,
  `apps/mobile/lib/app/router.dart`,
  `apps/mobile/lib/features/session/presentation/new_session_screen.dart`,
  `apps/mobile/lib/core/push/push_service.dart`, `apps/mobile/lib/l10n/`.

### F12 — Entrevista y parecer

- **F12.1 — Turnos de entrevista**: `interviewScenario`,
  `buildInterviewTurnMessages`, `InterviewTurnOutput`, `active_sec`, corte a
  540/600 s, correcciones ocultas, extensión de `TurnResultDto`, sweeper a 24 h,
  `POST /interviews/:id/session`. Depends on: F10.3. Files/dirs:
  `apps/api/src/sessions/`, `apps/api/src/llm/prompts/interview-turn.ts`,
  `apps/api/src/llm/schemas.ts`, `apps/api/src/interviews/`.
- **F12.2 — `/v1/feedback` en el agente**: agente del parecer con
  verificación por búsqueda, comparación y `studyPlan`; tests de tono (FR-13),
  de evidencia literal y de tolerancia a errores de STT (FR-35). Depends on:
  F10.2. Files/dirs: `apps/interview-agent/`.
- **F12.3 — Job `interview-feedback`**: cierre de la entrevista → job,
  verificación de evidencia, guardado, memoria (D6), push
  `interview_feedback_ready`, `GET /interviews/:id/feedback`. Depends on:
  F12.1, F12.2. Files/dirs: `apps/api/src/jobs/interviews/`,
  `apps/api/src/interviews/`, `apps/api/src/memory/`, `apps/api/src/push/`.
- **F12.4 — App: modo entrevista y parecer**: `ConversationMode.interview` en
  `conversation_screen.dart` (sin revisión, sin chips, encabezado y Terminar),
  pantallas IE-05 e IE-06a–e. Depends on: F11.2, F12.1 (contrato del turno).
  Files/dirs: `apps/mobile/lib/features/session/`,
  `apps/mobile/lib/features/interviews/presentation/`, `apps/mobile/lib/l10n/`.

### F13 — Ciclo de estudio y re-entrevista

- **F13.1 — Ciclo en la API**: `POST/GET /cycle`, `start` con desbloqueo en
  orden, `studyScenario` en sesiones `study`, marca `done_at` al cerrar,
  `reinterview` con `parent_interview_id` y `previousFeedback`, cron
  `study-reminder`. Depends on: F12.3. Files/dirs: `apps/api/src/interviews/`,
  `apps/api/src/sessions/scenario.ts`, `apps/api/src/jobs/maintenance/`,
  `apps/api/src/push/`.
- **F13.2 — App: ciclo y comparación**: pantallas IE-07 e IE-08, inicio de
  sesiones del ciclo con la conversación normal. Depends on: F12.4, F13.1.
  Files/dirs: `apps/mobile/lib/features/interviews/presentation/`,
  `apps/mobile/lib/l10n/`.

### Infra (dentro de F10.2)

App interna nueva en Coolify `fluent-interview-agent` (build context
`apps/interview-agent`), en la misma red que `fluent-api`, `fluent-worker` y
`fluent-9router`; healthcheck `/healthz`. Variables de I4 en Coolify. Runbook
en `docs/runbooks/despliegue.md`.
