---
type: arch
project_id: fluent
version: 0.1
depends_on:
  - docs/prd/002-sesion-grupal.md
  - docs/arch/001-9router-y-planes.md
generated_by: orch-arch
generated_at: 2026-10-06
title: Sesión grupal con el tutor IA — architecture
---

# Sesión grupal con el tutor IA — architecture

## Context

Hoy toda la práctica es 1 a 1: `POST v1/sessions` abre una fila en `sessions`,
cada turno pasa por `TurnsService.addTurn` (`apps/api/src/sessions/turns.service.ts`)
con una sola llamada LLM que devuelve respuesta + correcciones (`TurnOutput`,
`llm/schemas.ts`), streameada por SSE (`sessions/turn-stream.ts`). Al cerrar,
el RPC `close_session` calcula XP y streak en SQL, y el job `coaching-brief`
actualiza brief, errores recurrentes y hechos con `apply_brief`.

El grupo existe solo como `profiles.group_id` (un grupo por usuario) con
leaderboard (`weekly_leaderboard`, suma de `xp_events`), desafíos y resumen
semanal. Push va por FCM (`push/push.service.ts`), sin agrupación. **No hay
realtime** (ni WebSocket ni InsForge realtime), **no hay audio subido** y la app
no tiene paquete de grabación.

El PRD añade una sala en vivo por grupo donde varios miembros escriben o mandan
notas de voz, el tutor modera con cadencia propia y, al cerrar, cada
participante recibe XP, streak, historial y actualización de su brief.

## Components

### Datos de la sala (`apps/api/migrations`, `src/db`)
Tablas nuevas `group_sessions`, `group_session_participants`,
`group_session_messages`, `group_session_corrections`, el RPC
`close_group_session` y la extensión de `sessions.kind` / `xp_events.kind` con
`'group'`. Dueño: el esquema y sus tests SQL.

### RoomBus (`src/group-sessions/room-bus.ts`)
Pub/sub sobre Redis: canal `gs:{sessionId}`. Publica eventos de sala y los
reparte a las conexiones SSE abiertas en cualquier instancia de la API o el
worker. Además lleva la presencia: clave `gs:{sessionId}:online:{userId}` con
TTL 45 s, renovada por el heartbeat del stream. No persiste nada.

### GroupSessionsService + controller (`src/group-sessions/`)
Ciclo de vida: iniciar, unirse, salir, cerrar, enviar mensaje, compartir
correcciones, snapshot, stream SSE. Toda llamada pasa por
`GroupAccessService.requireOwnGroup` (`social/group-access.service.ts`) y
comprueba que `group_sessions.group_id` es el grupo del usuario; las escrituras
exigen además participación activa. Inserta mensajes de sistema (FR-14) y
publica en RoomBus. Al recibir un mensaje de participante avisa al
TutorScheduler y al GroupPush.

### GroupSweeper (`src/group-sessions/group-sweeper.service.ts`)
Engancha al cron por minuto existente (`session-sweeper`, cola `maintenance`):
aviso a los 25 min, cierre a los 30 min y tras 10 min sin mensajes (FR-5,
FR-14). Precisión ±1 min, suficiente.

### TutorScheduler + GroupTutorProcessor (`src/group-sessions/tutor/`, `src/jobs/group-tutor/`)
Decide cuándo habla el tutor (FR-10) y ejecuta la llamada en el worker:
- Contador Redis `gs:{id}:since_tutor` (INCR por mensaje de participante,
  reset al responder el tutor).
- Dispara si el mensaje menciona `@tutor`, si el contador llega a
  `GROUP_TUTOR_EVERY_N` (3), o por estancamiento: cada mensaje programa un job
  diferido de 60 s con `jobId = stall:{id}:{messageId}` que solo actúa si ese
  mensaje sigue siendo el último.
- Al iniciar la sesión, un job `open` escribe la apertura del tutor.
- Job `group-tutor` en la cola nueva `group` (concurrencia 6) con lock Redis
  `gs:{id}:tutor`: un solo turno del tutor a la vez por sala; lo que llega
  durante la llamada cuenta para el siguiente.
- Cobra el turno con `DailyTurnsBudget` al usuario que disparó (el autor del
  mensaje; en estancamiento, el autor del último mensaje; en apertura, el
  iniciador). Si ese usuario no tiene cupo, el tutor no habla y se publica el
  evento de sistema `tutor_unavailable`.
- Resuelve el modelo con el plan y la preferencia del **iniciador** (NFR-2) vía
  `LlmService.complete`, streamea `reply` como `tutor_token` por RoomBus y
  guarda mensaje + correcciones.

### Prompt de grupo (`src/llm/prompts/group-turn.ts`, `src/llm/schemas.ts`)
`buildGroupTurnMessages(input)` y el esquema `GroupTurnOutput`. Recibe el
escenario (reutiliza `rebuildScenario`, `sessions/scenario.ts`), los últimos 20
mensajes con autor, el nivel mínimo de los presentes (FR-13), los participantes
callados (sin mensaje en los últimos 4 del grupo, calculado en código, FR-9) y
el idioma de interfaz de cada autor para las notas de corrección (FR-11).
**Nunca** recibe brief ni hechos (NFR-3).

### DailyTurnsBudget (`src/sessions/daily-turns-budget.ts`)
Extrae a un servicio inyectable el `requireDailyTurnsBudget` privado de
`TurnsService`, con la misma clave Redis `turns:day:{userId}:{día}`, los mismos
topes y el mismo fail-open. 1:1 y grupo cuentan contra el mismo tope.

### GroupPush (`src/push/`)
`PushService.notifyGroupSessionStarted(sessionId)` (FR-2) y
`notifyGroupMessage(sessionId, authorId)` (FR-8). Esta última solo envía a los
participantes activos que no están online en RoomBus, con un throttle de
flanco inicial `push:gs:{sessionId}:{userId}` (SET NX EX 60): como mucho una
notificación por minuto por usuario y sala.

### VoiceNotes (`src/group-sessions/voice/`, F8)
Bucket privado de InsForge `group-voice`. La API recibe multipart (m4a
≤ 60 s, ≤ 2 MB), lo sube con el cliente admin y sirve la descarga tras la misma
comprobación de acceso. `RetentionService` (`jobs/maintenance/retention.service.ts`)
borra los objetos de más de 30 días y pone `audio_key = null` (NFR-5).

### Cierre y progreso (`src/group-sessions/group-closer.service.ts`, F9)
Al cerrar (por cualquiera de las tres vías):
1. Llama a `close_group_session`, que, por cada participante con al menos un
   mensaje, crea una fila en `sessions` (`kind = 'group'`,
   `group_session_id`), inserta `xp_events` y avanza el streak si envió 5 o más
   mensajes (FR-16).
2. Encola el job `group-recap`: una llamada LLM (`GroupRecapOutput`), cobrada al
   iniciador, que publica el evento `recap` (FR-15).
3. Encola `coaching-brief` por cada fila `sessions` con 3 o más mensajes
   (FR-18).

### Brief solo con errores (`src/jobs/coaching-brief/`, `src/llm/prompts/brief.ts`)
`CoachingBriefService.run(sessionId)` detecta `kind = 'group'`, carga solo los
mensajes de ese usuario con sus correcciones y usa la variante del prompt sin
el campo `facts`. Llama a `apply_brief` con `p_facts = []`, así no aparecen
hechos pendientes nuevos (FR-18).

### Historial (`src/sessions/sessions-history.*`)
`GET v1/sessions` ya lista las filas `kind = 'group'` del usuario (FR-17).
`GET v1/sessions/:id` con `kind = 'group'` devuelve los mensajes de la sala y
solo las correcciones visibles para ese usuario.

### Mobile (`apps/mobile/lib/features/group_session/`)
Feature nueva `data/domain/presentation`:
- `GroupSessionScreen` con mensajes, eventos de sistema, el tutor en streaming,
  chips de corrección (los propios, más los compartidos), el toggle "compartir
  mis correcciones" y el cierre con XP y recap.
- Cliente SSE que reutiliza el parser de `http_fluent_api.dart`.
- Botón "sesión grupal" en `GroupScreen`, que muestra la sesión en curso.
- Ruta `/group-session/:id` en `app/router.dart` y en la allowlist de
  `core/push/push_service.dart`.
- En F8, grabación de voz con el paquete `record` más la transcripción nativa
  existente (`SpeechToTextService`).

## Data model

Migración `apps/api/migrations/20261006120000_sesion-grupal.sql`. Tablas en
`TABLES` (`db/schema.ts`) y RPCs en `db/rpc.ts`. RLS activado y
`REVOKE ALL FROM anon, authenticated`: solo la API con rol admin, como
`xp_events`.

```sql
group_sessions (
  id uuid pk, group_id uuid not null → groups, initiator_id uuid not null → profiles,
  kind text check (kind in ('free_topic','roleplay','news')),
  topic text, roleplay_id text, news_item_id uuid,
  status text not null default 'active' check (status in ('active','ended')),
  end_reason text check (end_reason in ('initiator','max_duration','idle')),
  started_at timestamptz not null default now(), ended_at timestamptz,
  last_message_at timestamptz not null default now(),
  warned_at timestamptz,                -- aviso de 25 min ya emitido
  recap jsonb                           -- GroupRecapOutput
)
CREATE UNIQUE INDEX group_sessions_one_active ON group_sessions (group_id) WHERE status = 'active';  -- FR-4

group_session_participants (
  session_id uuid → group_sessions, user_id uuid → profiles, pk (session_id, user_id),
  joined_at timestamptz not null, left_at timestamptz,          -- null = activo
  present_sec int not null default 0,                            -- acumulado en cada salida/cierre
  share_corrections boolean not null default false,             -- FR-12
  messages_count int not null default 0
)

group_session_messages (
  id bigserial pk,                       -- también es el orden y el cursor
  session_id uuid not null → group_sessions,
  role text check (role in ('user','tutor','system')),
  author_id uuid → profiles,             -- null para tutor y sistema
  text text not null,                    -- en una nota de voz, la transcripción
  audio_key text, audio_ms int,          -- F8; audio_key = null tras 30 días
  system_event text check (system_event in ('joined','left','ending_soon','ended','tutor_unavailable')),
  model text, tokens_in int, tokens_out int, latency_ms int,
  created_at timestamptz not null default now()
)
INDEX (session_id, id)

group_session_corrections (
  id bigserial pk, session_id uuid, message_id bigint → group_session_messages,
  user_id uuid,                          -- autor del mensaje corregido
  original text, corrected text, category text, note text
)
```

Cambios en tablas existentes:
- `sessions.kind` suma `'group'` y una columna `group_session_id uuid null`.
- `xp_events.kind` suma `'group'`.
- `PushKind` suma `'group_session' | 'group_message'`.
- El bloque de streak de `close_session` se extrae a
  `advance_streak(p_user_id uuid, p_ended_at timestamptz) returns int`, que
  usan `close_session` y `close_group_session`. Sin cambio de comportamiento:
  lo cubren los tests existentes `migrations/tests/close_session.sql`.

`close_group_session(p_session_id uuid, p_reason text) returns jsonb`: marca la
sala `ended`, cierra la presencia de todos los participantes y, por cada
participante con `messages_count ≥ 1`, inserta en `sessions` (`user_id`,
`kind = 'group'`, `group_session_id`, `status = 'ended'`, `duration_sec =
present_sec`, `turns_count = messages_count`, `xp_earned`). Calcula
`xp = least(messages_count × 5, 60) + least(present_min × 2, 30)` (constantes
reflejadas en `config/product.ts` como `GROUP_XP_*`), lo inserta en
`xp_events` y llama a `advance_streak` si `messages_count ≥ 5`. Devuelve
`[{userId, sessionId, xp, streak}]`. Es idempotente: si la sala ya está
`ended`, devuelve lo ya calculado.

## Interfaces

Todas bajo `v1`, con `AuthGuard` global. Códigos nuevos en `common/api-error.ts`:
`GROUP_SESSION_ACTIVE` (409), `GROUP_SESSION_ENDED` (409),
`GROUP_SESSION_FORBIDDEN` (403) y `NOT_PARTICIPANT` (403).

| Método y ruta | Body | Respuesta |
| --- | --- | --- |
| `POST group-sessions` | `{kind, topic?, roleplayId?, newsItemId?}` | `201 GroupSessionDto`, o `409 GROUP_SESSION_ACTIVE {sessionId}` (FR-4) |
| `GET group-sessions/active` | — | `GroupSessionDto` o `204` |
| `GET group-sessions/:id` | — | `GroupSessionDetailDto` |
| `POST group-sessions/:id/join` | — | `204` |
| `POST group-sessions/:id/leave` | — | `204` |
| `POST group-sessions/:id/end` | — | `204`; solo el iniciador |
| `POST group-sessions/:id/messages` | `{text ≤ 1000, clientId}` | `201 GroupMessageDto` |
| `POST group-sessions/:id/voice-messages` (F8) | multipart `audio` (m4a), `transcript`, `durationMs ≤ 60000`, `clientId` | `201 GroupMessageDto` |
| `GET group-sessions/:id/messages/:messageId/audio` (F8) | — | `audio/mp4`, o `410` si ya se borró |
| `PUT group-sessions/:id/share-corrections` | `{share: boolean}` | `204` |
| `GET group-sessions/:id/events` | — | `text/event-stream` |

```ts
GroupSessionDto       = { id, kind, topic, initiator: {id, name}, status, startedAt, endsAt, participants: ParticipantDto[] }
ParticipantDto        = { userId, name, avatarUrl, active: boolean, shareCorrections: boolean }
GroupMessageDto       = { id: number, role: 'user'|'tutor'|'system', authorId: string|null, text,
                          systemEvent?: string, hasAudio: boolean, audioMs?: number, createdAt, clientId? }
GroupCorrectionDto    = { messageId: number, authorId, original, corrected, category, note }
GroupSessionDetailDto = GroupSessionDto & { messages: GroupMessageDto[], corrections: GroupCorrectionDto[] /* solo las visibles */, recap?: GroupRecapDto, xp?: {userId, xp}[] }
```

**Stream SSE** (`event:` / `data:` JSON, el mismo formato que `turn-stream.ts`):
- `message` → `GroupMessageDto` (participante, tutor final o sistema).
- `tutor_token` → `{ text }`: el delta del tutor en curso; el `message` final lo
  reemplaza.
- `corrections` → `{ messageId, authorId, items: GroupCorrectionDto[] }`. Se
  filtra por conexión: llega al autor, y a los demás solo si el autor tiene
  `share_corrections` (FR-11, FR-12).
- `participants` → `ParticipantDto[]`, con cada cambio.
- `ended` → `{ reason, xp: {userId, xp}[] }`.
- `recap` → `GroupRecapDto`.
- `: ping`, un comentario cada 20 s que también renueva la presencia.

Al reconectar, el cliente vuelve a pedir `GET group-sessions/:id` y abre el
stream de nuevo; deduplica por `id` y por `clientId`. No hay replay por
`Last-Event-ID`.

**RoomBus** (TS):
```ts
publish(sessionId: string, event: RoomEvent): Promise<void>
subscribe(sessionId: string, onEvent: (e: RoomEvent) => void): () => void   // devuelve unsubscribe
markOnline(sessionId: string, userId: string): Promise<void>                 // TTL 45 s
onlineUsers(sessionId: string): Promise<Set<string>>
type RoomEvent = { type: 'message'|'tutor_token'|'corrections'|'participants'|'ended'|'recap', data: unknown }
```

**LLM** (`llm/schemas.ts`):
```ts
GroupTurnOutput  = { reply: string ≤ 1200,
                     corrections: { messageId: number, original, corrected, category: CATEGORIES, note ≤ 140 }[] ≤ 6 }
GroupRecapOutput = { topics: string[] ≤ 5, highlights: { userId: string, quote: string ≤ 200 }[] }   // en inglés
GroupTurnPromptInput = { scenario, messages: {id, authorName, role, text, locale}[],
                         minLevel: CefrLevel, quietParticipants: string[], trigger: 'open'|'mention'|'every_n'|'stall' }
```

**Jobs**: la cola nueva `group` (`jobs/jobs.constants.ts`) tiene estos jobs:
- `group-tutor` `{sessionId, trigger, triggeredBy, uptoMessageId}`, con jobId
  `tutor:{sessionId}:{uptoMessageId}`.
- `group-tutor` diferido con `trigger = 'stall'`, `delay: 60_000` y jobId
  `stall:{sessionId}:{messageId}`.
- `group-recap` `{sessionId}`, con jobId `recap:{sessionId}`.

**DailyTurnsBudget**:
`consume(userId: string, plan: Plan, tz: string): Promise<void>`. Si no hay
cupo lanza `429 TURNS_DAILY_CAP`.

**Push**: el payload sigue siendo `{type, route}`, con
`route = '/group-session/{id}'`.

## Decisions

- **D1 — Realtime.** Elegido: SSE por sala, servido por NestJS sobre Redis
  pub/sub. Rechazado:
  - WebSocket (socket.io), porque añade dependencia en API y app más sticky
    sessions, cuando el SSE y su parser en la app ya existen.
  - InsForge realtime, porque no se usa y la API accede con el cliente admin
    saltándose RLS: habría que diseñar políticas por grupo solo para esto.
  - Polling, porque cumplir < 2 s exige pedir cada segundo por usuario.
- **D2 — Tablas propias para la sala + una fila `sessions` por participante al
  cerrar.** Rechazado: meter el grupo dentro de `sessions`/`turns`, porque
  `sessions.user_id` es de un solo dueño y `turns.idx` lo es por sesión. La
  fila `kind = 'group'` hace que historial, leaderboard (`xp_events`), resumen
  semanal (conteo de sesiones), insignias y brief funcionen sin tocarlos.
- **D3 — El tutor corre en el worker (cola `group`), no inline en el POST del
  mensaje.** Rechazado: inline como en 1:1, porque el POST lo hace un
  participante y el tutor responde a la sala; además el estancamiento necesita
  jobs diferidos igualmente.
- **D4 — Correcciones en lote con la respuesta del tutor** (NFR-1: una llamada).
  Los chips llegan cuando habla el tutor, no al instante de cada mensaje.
  Rechazado: una llamada por mensaje, porque rompe NFR-1 y G3.
- **D5 — Push agrupado con throttle de flanco inicial** (1/min por usuario y
  sala). Rechazado: digest diferido con contador, porque es más código para la
  misma garantía de FR-8.
- **D6 — Cobro al que dispara; recap y apertura al iniciador; sin cupo, el
  tutor calla** (decisión del operador del 2026-10-06). Rechazado: reparto
  entre participantes.
- **D7 — Recap en inglés para todos.** Rechazado: un recap por idioma de
  interfaz, porque son N llamadas y NFR-1 pide una por sesión.
- **D8 — Grupo cuenta como sesión válida del día** en el tope de 3 de
  `close_session`. Rechazado: excluirla, porque sería un filtro más sin
  beneficio claro. Revisable con datos.
- **D9 — Audio a través de la API** (subida multipart y descarga proxy) en un
  bucket privado. Rechazado: URL firmada directa, porque no consta que el SDK
  de InsForge la exponga y el control de acceso queda en un solo sitio.

## Risks

- **Micrófono compartido en Android:** `record` y `speech_to_text` a la vez
  pueden no convivir (Android no garantiza dos capturas simultáneas).
  *Mitigación:* F8.1 empieza con un spike en dispositivo real. Si falla, la nota
  de voz se publica solo como transcripción con marca de voz y el audio queda
  fuera hasta encontrar otra vía.
- **Conexiones SSE largas detrás del proxy de Coolify** (timeouts, buffering).
  *Mitigación:* `X-Accel-Buffering: no`, ping cada 20 s y reconexión del
  cliente con snapshot. Hay que probarlo en el entorno desplegado en F6.
- **Consultas existentes que asumen 1:1** al ver filas `kind = 'group'`
  (`listCandidateSessionsForMembers` para desafíos, `listTopicsSince`,
  `rebuildScenario`, el banco de boss). *Mitigación:* F9.1 audita y excluye
  `'group'` donde no aplica, con un test por consulta.
- **`apply_brief` reemplaza el brief entero** con lo que ve una sola sesión
  grupal. *Mitigación:* la variante del prompt para grupo recibe el brief
  anterior igual que la de 1:1 (comportamiento actual) y no pide hechos.
- **Costo:** una sala de 8 activos puede disparar muchos turnos del tutor.
  *Mitigación:* lock de un turno a la vez, N = 3 y tope diario por quien
  dispara. Se mide con `llm_calls` (purpose `group_turn` / `group_recap`)
  contra G3.

## Requirement coverage

| Requirement | Component(s) |
| --- | --- |
| FR-1 | GroupSessionsService (`POST group-sessions`), Mobile |
| FR-2 | GroupPush `notifyGroupSessionStarted`, Mobile (deep link) |
| FR-3 | GroupSessionsService join/leave + snapshot, GroupPush (solo participantes activos) |
| FR-4 | Índice único parcial `group_sessions_one_active`, `409 GROUP_SESSION_ACTIVE` |
| FR-5 | GroupSessionsService `end`, GroupSweeper, `close_group_session` |
| FR-6 | `POST messages`, RoomBus, SSE |
| FR-7 | VoiceNotes, Mobile (`record` + `SpeechToTextService`) |
| FR-8 | GroupPush `notifyGroupMessage`, presencia de RoomBus |
| FR-9 | Prompt de grupo (`quietParticipants`) |
| FR-10 | TutorScheduler (mención, cada N, estancamiento de 60 s) |
| FR-11 | `GroupTurnOutput.corrections`, filtro por conexión en el SSE, snapshot filtrado |
| FR-12 | `PUT share-corrections`, filtro SSE |
| FR-13 | Prompt de grupo (`minLevel`), banco de prompts |
| FR-14 | Mensajes `role = 'system'`, GroupSweeper (`ending_soon`) |
| FR-15 | `group-recap` job, evento `recap`, `ended.xp`, Mobile |
| FR-16 | `close_group_session`, `advance_streak`, `xp_events` |
| FR-17 | Fila `sessions` por participante, SessionsHistory `kind = 'group'` |
| FR-18 | CoachingBriefService variante grupo, `p_facts = []` |
| NFR-1 | TutorScheduler (una llamada por turno, lock), DailyTurnsBudget |
| NFR-2 | GroupTutorProcessor resuelve con el plan del iniciador |
| NFR-3 | Prompt de grupo sin brief ni hechos; correcciones privadas por defecto |
| NFR-4 | RoomBus + SSE; streaming de `tutor_token` |
| NFR-5 | RetentionService (audio > 30 días) |
| NFR-6 | `requireOwnGroup` + participación en cada endpoint; tests de acceso en F6.3 |
| NFR-7 | NestJS + InsForge + BullMQ + FCM; STT nativo. Lo único nuevo es el paquete `record` en la app |
| Resumen semanal | Sin cambios: cuenta las filas `sessions` y `xp_events` de grupo |

## Work breakdown

Las fases continúan después de F5 (specs/f1–f5).

### F6 — Sala grupal por texto (M1)
- **F6.1 — Esquema**: migración con las cuatro tablas, el índice único parcial,
  `'group'` en `sessions.kind` y `xp_events.kind`, `sessions.group_session_id`
  y los tipos en `TABLES`. Tests SQL de restricciones. `close_group_session`
  queda para F9.1. Archivos: `apps/api/migrations/20261006120000_sesion-grupal.sql`,
  `apps/api/migrations/tests/group_sessions.sql`, `apps/api/src/db/schema.ts`.
- **F6.2 — RoomBus y stream SSE**: pub/sub, presencia, `GET events` con filtro
  de correcciones por conexión y ping. Archivos:
  `apps/api/src/group-sessions/room-bus.ts`, `apps/api/src/group-sessions/room-stream.ts`,
  `apps/api/src/group-sessions/room-bus.spec.ts`. Depende de: F6.1.
- **F6.3 — Ciclo de vida y mensajes de texto**: el módulo, el controller,
  start/active/detail/join/leave/end/messages/share-corrections, los eventos de
  sistema, el cierre provisional (marca `ended` sin XP), GroupSweeper y los
  tests de acceso (NFR-6). Archivos: `apps/api/src/group-sessions/group-sessions.module.ts`,
  `apps/api/src/group-sessions/group-sessions.controller.ts`,
  `apps/api/src/group-sessions/group-sessions.service.ts`,
  `apps/api/src/group-sessions/group-sessions.repository.ts`,
  `apps/api/src/group-sessions/dto/`, `apps/api/src/group-sessions/group-sweeper.service.ts`,
  `apps/api/src/common/api-error.ts`, `apps/api/src/app.module.ts`.
  Depende de: F6.1, F6.2.
- **F6.4 — Push de convocatoria**: `notifyGroupSessionStarted`, `PushKind`
  `group_session`, mensajes i18n. Archivos: `apps/api/src/push/push.service.ts`,
  `apps/api/src/push/push.messages.ts`. Depende de: F6.1.
- **F6.5 — App: sala por texto**: el feature `group_session` (API client, SSE,
  pantalla, eventos de sistema), la entrada desde `GroupScreen`, la ruta, la
  allowlist de push y los textos l10n en es/en/pt. Archivos:
  `apps/mobile/lib/features/group_session/`, `apps/mobile/lib/features/group/presentation/group_screen.dart`,
  `apps/mobile/lib/app/router.dart`, `apps/mobile/lib/core/push/push_service.dart`,
  `apps/mobile/lib/l10n/`. Se construye contra el contrato de *Interfaces*.
  Depende de: F6.3, para la prueba de punta a punta.

### F7 — El tutor en el grupo (M2)
- **F7.1 — Prompt y esquema de grupo**: `buildGroupTurnMessages`,
  `GroupTurnOutput`, cálculo de `quietParticipants` y `minLevel`, casos en el
  banco de prompts (FR-9, FR-13). Archivos: `apps/api/src/llm/prompts/group-turn.ts`,
  `apps/api/src/llm/prompts/group-turn.spec.ts`, `apps/api/src/llm/schemas.ts`.
- **F7.2 — DailyTurnsBudget**: extraerlo de `TurnsService` sin cambiar el
  comportamiento 1:1. Archivos: `apps/api/src/sessions/daily-turns-budget.ts`,
  `apps/api/src/sessions/turns.service.ts`, `apps/api/src/sessions/sessions.module.ts`.
- **F7.3 — TutorScheduler y procesador**: la cola `group`, los disparadores
  (apertura, mención, cada N, estancamiento), el lock, el cobro, el streaming
  por RoomBus y la persistencia de mensaje + correcciones. Archivos:
  `apps/api/src/group-sessions/tutor/`, `apps/api/src/jobs/group-tutor/`,
  `apps/api/src/jobs/jobs.constants.ts`, `apps/api/src/worker.module.ts`.
  Depende de: F7.1, F7.2.
- **F7.4 — App: tutor y correcciones**: el tutor en streaming, el botón
  `@tutor`, los chips propios y compartidos, el toggle de compartir y el TTS
  opcional como en 1:1. Archivos: `apps/mobile/lib/features/group_session/`.
  Depende de: F7.3.

### F8 — Voz y push de mensajes (M3)
- **F8.1 — App: nota de voz**: empieza con el spike de micrófono compartido,
  luego el paquete `record`, la transcripción con revisión, la subida y la
  reproducción. Archivos: `apps/mobile/lib/features/group_session/`,
  `apps/mobile/pubspec.yaml`, `apps/mobile/ios/Runner/Info.plist`,
  `apps/mobile/android/app/src/main/AndroidManifest.xml`.
- **F8.2 — API: VoiceNotes**: el bucket `group-voice`, `POST voice-messages`,
  `GET audio` y la retención de 30 días. Archivos:
  `apps/api/src/group-sessions/voice/`, `apps/api/src/jobs/maintenance/retention.service.ts`.
- **F8.3 — Push de mensajes agrupado**: `notifyGroupMessage` con presencia y
  throttle. Archivos: `apps/api/src/push/push.service.ts`,
  `apps/api/src/push/push.messages.ts`,
  `apps/api/src/group-sessions/group-sessions.service.ts`.

### F9 — Progreso (M4)
- **F9.1 — Cierre con XP y streak**: `advance_streak`, `close_group_session`,
  `GROUP_XP_*`, `GroupCloser`, y la auditoría de las consultas que deben
  excluir `'group'`. Archivos:
  `apps/api/migrations/20261006130000_cierre-sesion-grupal.sql`,
  `apps/api/migrations/tests/close_group_session.sql`,
  `apps/api/src/group-sessions/group-closer.service.ts`,
  `apps/api/src/config/product.ts`, `apps/api/src/db/rpc.ts`,
  `apps/api/src/sessions-query/sessions-query.repository.ts`.
- **F9.2 — Recap**: `GroupRecapOutput`, el prompt y el job `group-recap`.
  Archivos: `apps/api/src/llm/prompts/group-recap.ts`,
  `apps/api/src/jobs/group-recap/`. Depende de: F9.1.
- **F9.3 — Brief solo con errores**: la variante de grupo en
  `CoachingBriefService` y el prompt sin hechos. Archivos:
  `apps/api/src/jobs/coaching-brief/`, `apps/api/src/llm/prompts/brief.ts`.
  Depende de: F9.1.
- **F9.4 — Historial y app**: el detalle `kind = 'group'` en
  sessions-history, la pantalla de cierre con XP y recap, y el historial que
  abre la sala en solo lectura. Archivos: `apps/api/src/sessions/sessions-history.service.ts`,
  `apps/api/src/sessions/sessions-history.repository.ts`,
  `apps/mobile/lib/features/group_session/`, `apps/mobile/lib/features/session/presentation/`.
  Depende de: F9.1, F9.2.
