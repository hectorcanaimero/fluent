---
type: spec
project_id: fluent
phase: 6
version: 0.1
depends_on:
  - docs/arch/002-sesion-grupal.md
  - docs/prd/002-sesion-grupal.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-06
title: Sala grupal por texto
---

# F6 — Sala grupal por texto

Un miembro abre una sesión grupal y el resto del grupo recibe un push, se une y
chatea por texto en tiempo real. La sala tiene eventos de sistema y se cierra
por el iniciador, a los 30 minutos o tras 10 minutos sin mensajes. En esta fase
el tutor todavía no habla (F7) y el cierre no da XP (F9).

Arquitectura: `docs/arch/002-sesion-grupal.md`, secciones *Components*,
*Data model* e *Interfaces*. PRD: `docs/prd/002-sesion-grupal.md` (FR-1 a FR-6,
FR-14, NFR-4, NFR-6).

Contexto del repo:
- `apps/api` es NestJS 12 en ESM sobre Node 24, con vitest. Los imports
  internos llevan sufijo `.js` y los comentarios van en español.
- El acceso a datos es `@insforge/sdk` con el cliente admin (`INSFORGE_ADMIN_CLIENT`):
  `admin.database.from(TABLES.x)` y `.rpc(...)`. No hay SQL crudo en TS.
- Las rutas llevan el prefijo global `v1`. La autenticación la cubren el
  `AuthGuard` global y `@CurrentUser('id')`.
- `apps/mobile` es Flutter con Riverpod, go_router, dio y freezed.

## F6.1 — Package: esquema

### F6.1.T1 — Migración de la sala grupal y tipos

Crear `apps/api/migrations/20261006120000_sesion-grupal.sql` con el contenido de
la sección *Data model* de la arquitectura:
- Las tablas `group_sessions`, `group_session_participants`,
  `group_session_messages` y `group_session_corrections`, con sus checks.
- El índice único parcial `group_sessions_one_active ON group_sessions (group_id) WHERE status = 'active'`.
- El índice `(session_id, id)` en mensajes.
- `ALTER` de los checks de `sessions.kind` y `xp_events.kind` para aceptar
  `'group'`. Antes de reescribirlos, busca su nombre actual en
  `20260908190806_sesiones-turnos-correcciones.sql` y en las migraciones que
  lo amplían, como `boss`.
- La columna `sessions.group_session_id uuid NULL REFERENCES group_sessions(id)`.
- RLS activado en las cuatro tablas y `REVOKE ALL ... FROM anon, authenticated`,
  igual que `xp_events`: solo la API accede.

En `apps/api/src/db/schema.ts` hay que:
- Añadir las cuatro tablas a `TABLES`.
- Definir los tipos de fila `GroupSession`, `GroupSessionParticipant`,
  `GroupSessionMessage` y `GroupSessionCorrection`.
- Sumar `'group'` a `SessionKind`.
- Añadir `group_session_id` a `Session`.

Test SQL `apps/api/migrations/tests/group_sessions.sql`, con el mismo estilo que
`migrations/tests/close_session.sql`. Debe comprobar que:
- Una segunda sala `active` del mismo grupo falla por el índice único.
- Una sala `ended` no bloquea abrir otra.
- `role = 'system'` con un `system_event` fuera del check falla.

Done when: la migración aplica sobre una base limpia, el test SQL pasa y
`pnpm --filter api build` compila.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: SQL con restricciones y RLS; conviene el tier estándar de Claude.
- **Dependencies**:
- **Files**:
  - `apps/api/migrations/20261006120000_sesion-grupal.sql`
  - `apps/api/migrations/tests/group_sessions.sql`
  - `apps/api/src/db/schema.ts`

## F6.2 — Package: tiempo real

### F6.2.T1 — RoomBus: pub/sub y presencia sobre Redis

Implementar `RoomBus` en `apps/api/src/group-sessions/room-bus.ts` con la
interfaz exacta de *Interfaces → RoomBus*:
- `publish(sessionId, event)`, con el canal Redis `gs:{sessionId}` y el payload
  en JSON.
- `subscribe(sessionId, onEvent)`, que devuelve la función de unsubscribe.
- `markOnline(sessionId, userId)`, que pone la clave
  `gs:{sessionId}:online:{userId}` con TTL de 45 s.
- `onlineUsers(sessionId)`.

Detalles:
- Usa una sola conexión suscriptora por proceso (duplicada del cliente Redis del
  módulo `apps/api/src/redis`), que multiplexa los canales con un mapa de
  listeners. Desuscribe el canal de Redis cuando no le queden listeners.
- Exporta el tipo `RoomEvent` y declara `RoomBus` como provider de un
  `GroupRealtimeModule` (`apps/api/src/group-sessions/group-realtime.module.ts`)
  que importa el módulo Redis existente. Así el worker (F7) puede importarlo sin
  traer el controller.

Done when: `room-bus.spec.ts`, con Redis real o el mock que ya usen otros specs
del repo, cubre estos casos:
- Dos suscriptores del mismo canal reciben el evento.
- Tras el unsubscribe ya no llega nada.
- La presencia expira.
- `onlineUsers` solo lista las claves vivas.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Infra de concurrencia pequeña pero fácil de dejar con fugas de listeners.
- **Dependencies**:
- **Files**:
  - `apps/api/src/group-sessions/room-bus.ts`
  - `apps/api/src/group-sessions/room-bus.spec.ts`
  - `apps/api/src/group-sessions/group-realtime.module.ts`

### F6.2.T2 — Stream SSE de la sala con filtro de correcciones

En `apps/api/src/group-sessions/room-stream.ts`, implementar
`openRoomStream(res, { sessionId, userId, bus, canSeeCorrections })`, donde
`canSeeCorrections` es `(authorId: string) => boolean | Promise<boolean>`.

La función escribe el stream que describe *Interfaces → Stream SSE*:
- Mismo formato `event:` / `data:` que `apps/api/src/sessions/turn-stream.ts`.
- Cabeceras `Content-Type: text/event-stream`, `Cache-Control: no-cache` y
  `X-Accel-Buffering: no`.
- Se suscribe a `bus.subscribe(sessionId)` y reenvía cada `RoomEvent` como
  `event: <type>`.
- Un evento `corrections` solo se reenvía si su `authorId === userId` o si
  `canSeeCorrections(authorId)` devuelve `true`.
- Cada 20 s escribe el comentario `: ping` y llama a
  `bus.markOnline(sessionId, userId)`. También llama a `markOnline` al abrir.
- Cuando el cliente cierra (`res.on('close')`), desuscribe y para el ping.
- Tras reenviar el evento `ended`, cierra el stream.

No hace comprobaciones de acceso: las hace el controller (F6.3.T2) antes de
llamarla.

Done when: `room-stream.spec.ts`, con un `res` falso y un bus en memoria,
comprueba que:
- Las correcciones ajenas no compartidas no se escriben, y las propias y las
  compartidas sí.
- Sale el ping.
- El cierre desuscribe.
- `ended` termina el stream.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Contiene el filtro de privacidad de FR-11; no es para un modelo barato.
- **Dependencies**: F6.2.T1
- **Files**:
  - `apps/api/src/group-sessions/room-stream.ts`
  - `apps/api/src/group-sessions/room-stream.spec.ts`

## F6.3 — Package: ciclo de vida y mensajes

### F6.3.T1 — Módulo group-sessions: iniciar, consultar, unirse, salir y cerrar

Crear el módulo `apps/api/src/group-sessions/` (module, controller, service,
repository y `dto/`) y registrarlo en `apps/api/src/app.module.ts`. Importa
`GroupRealtimeModule` (F6.2.T1).

Endpoints, según *Interfaces*:

| Ruta | Comportamiento |
| --- | --- |
| `POST group-sessions` | Crea la sala (`kind`, `topic`, `roleplayId` o `newsItemId`, validados igual que `sessions/dto/create-session.dto.ts`, sin `boss`) y añade al iniciador como participante. Si el índice único salta, responde `409 GROUP_SESSION_ACTIVE` con el `sessionId` existente. Después llama a `PushService.notifyGroupSessionStarted` (F6.4.T1) sin bloquear la respuesta. |
| `GET group-sessions/active` | Devuelve la sala activa del grupo del usuario, o `204` si no hay. |
| `GET group-sessions/:id` | Devuelve `GroupSessionDetailDto` con los mensajes en orden de `id` y, en `corrections`, solo las del usuario o las de autores con `share_corrections`. |
| `POST group-sessions/:id/join` | Upsert del participante: `left_at = null`, `joined_at = now()`. Emite el evento de sistema `joined`. |
| `POST group-sessions/:id/leave` | Suma `present_sec += now - joined_at`, pone `left_at` y emite `left`. |
| `POST group-sessions/:id/end` | Solo lo puede hacer el iniciador; si no, `403 GROUP_SESSION_FORBIDDEN`. Llama a `close(sessionId, 'initiator')`. |

Reglas comunes:
- Toda ruta resuelve primero `GroupAccessService.requireOwnGroup(userId)`
  (`apps/api/src/social/group-access.service.ts`) y responde
  `403 GROUP_SESSION_FORBIDDEN` si `group_sessions.group_id` no es el grupo del
  usuario. Una sala inexistente da `404`.
- Una escritura sobre una sala `ended` responde `409 GROUP_SESSION_ENDED`.
- Añade los códigos a `apps/api/src/common/api-error.ts`.

`GroupSessionsService.close(sessionId, reason)` es **provisional** y F9.1.T2 la
reemplaza:
- Marca `status = 'ended'`, `ended_at` y `end_reason`.
- Cierra la presencia de los participantes activos.
- Inserta el mensaje de sistema `ended` y publica `message`.
- Publica `ended` con `xp: []`.
- Es idempotente.

Cada evento de sistema es una fila en `group_session_messages` con
`role = 'system'`, que se publica en RoomBus como `message`. Con cada cambio de
participantes se publica también `participants`.

Done when: los specs del service y del controller cubren estos casos:
- Iniciar.
- Segundo inicio con 409 y el id existente.
- `join` y `leave` con `present_sec`.
- `end` hecho por quien no es el iniciador da 403.
- Escribir sobre una sala `ended` da 409.
- El snapshot filtra las correcciones ajenas.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Núcleo de la feature con reglas de acceso; estándar de Claude con buen contexto.
- **Dependencies**: F6.1.T1, F6.2.T1, F6.4.T1
- **Files**:
  - `apps/api/src/group-sessions/group-sessions.module.ts`
  - `apps/api/src/group-sessions/group-sessions.controller.ts`
  - `apps/api/src/group-sessions/group-sessions.service.ts`
  - `apps/api/src/group-sessions/group-sessions.service.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.controller.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.repository.ts`
  - `apps/api/src/group-sessions/dto/`
  - `apps/api/src/common/api-error.ts`
  - `apps/api/src/app.module.ts`

### F6.3.T2 — Mensajes de texto, compartir correcciones y endpoint de eventos

Sobre el módulo de F6.3.T1, añadir tres endpoints.

**`POST group-sessions/:id/messages`** (`{text: string ≤ 1000, clientId: string}`):
- Exige participación activa; si no, `403 NOT_PARTICIPANT`.
- Inserta un mensaje `role = 'user'`, suma `messages_count` del participante,
  pone `group_sessions.last_message_at = now()` y publica `message` con el
  `clientId`.
- Responde `201 GroupMessageDto`.
- Aplica el throttler existente (`TURNS_THROTTLE`, `apps/api/src/rate-limit`).

Expone en el service `postUserMessage(sessionId, userId, { text, clientId, audioKey?, audioMs? })`.
La usarán las notas de voz (F8.2.T1), así que acepta ya los campos de audio y
los guarda.

**`PUT group-sessions/:id/share-corrections`** (`{share: boolean}`): actualiza
`share_corrections` del participante y publica `participants`.

**`GET group-sessions/:id/events`**:
- Aplica las mismas comprobaciones de grupo; además exige que el usuario sea
  participante (activo o que haya salido en esta sala).
- Llama a `openRoomStream` (F6.2.T2) con un `canSeeCorrections` que consulta
  `share_corrections` del autor. Ese valor se cachea mientras dura la conexión
  y se invalida al recibir un evento `participants`.
- Si la sala ya está `ended`, responde un único evento `ended` y cierra.

Done when: hay specs para el mensaje sin participación (403), el mensaje válido
(publica en el bus y actualiza contadores), el toggle de compartir y el stream
de una sala `ended`.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Sigue el patrón de F6.3.T1 con un filtro de privacidad.
- **Dependencies**: F6.3.T1, F6.2.T2
- **Files**:
  - `apps/api/src/group-sessions/group-sessions.controller.ts`
  - `apps/api/src/group-sessions/group-sessions.service.ts`
  - `apps/api/src/group-sessions/group-sessions.service.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.controller.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.repository.ts`
  - `apps/api/src/group-sessions/dto/`

### F6.3.T3 — GroupSweeper: aviso de 25 min y cierres automáticos

Crear `apps/api/src/group-sessions/group-sweeper.service.ts` y llamarlo desde
el cron por minuto que ya existe (`apps/api/src/jobs/session-sweeper.ts`, que
hoy invoca `apps/api/src/sessions/session-sweeper.service.ts`). Por cada sala
`active`:
- Si `now - started_at ≥ 25 min` y `warned_at` es null: inserta el mensaje de
  sistema `ending_soon`, lo publica y fija `warned_at`.
- Si `now - started_at ≥ 30 min`: `close(id, 'max_duration')`.
- Si `now - last_message_at ≥ 10 min`: `close(id, 'idle')`.

Las tres duraciones van como constantes en `apps/api/src/config/product.ts`:
`GROUP_SESSION_WARN_SEC = 1500`, `GROUP_SESSION_MAX_SEC = 1800` y
`GROUP_SESSION_IDLE_SEC = 600`. Exporta el sweeper desde
`group-sessions.module.ts` y que el worker lo importe.

Done when: el spec, con un reloj fijo, cubre el aviso emitido una sola vez, el
cierre por duración, el cierre por inactividad y una sala reciente intacta.

- **Model**: agy/gemini-3.8-flash-medium
- **Estimate**: 2h
- **Reason**: Lógica de tiempo acotada que sigue el patrón del sweeper existente; vale un modelo rápido.
- **Dependencies**: F6.3.T2
- **Files**:
  - `apps/api/src/group-sessions/group-sweeper.service.ts`
  - `apps/api/src/group-sessions/group-sweeper.service.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.module.ts`
  - `apps/api/src/jobs/session-sweeper.ts`
  - `apps/api/src/config/product.ts`
  - `apps/api/src/worker.module.ts`

### F6.3.T4 — Tests de aislamiento entre grupos (NFR-6)

Escribir `apps/api/src/group-sessions/group-sessions.access.spec.ts`. Prepara
dos grupos A y B, cada uno con dos miembros, y una sala activa en A. Un miembro
de B debe recibir `403 GROUP_SESSION_FORBIDDEN` en todas estas rutas:

- `GET :id`
- `POST join`, `POST leave`, `POST end` y `POST messages`
- `PUT share-corrections`
- `GET events`

Además:
- Un miembro de A que no se unió recibe `403 NOT_PARTICIPANT` en `messages`.
- `GET active` de un miembro de B devuelve `204`.

Usa el mismo arnés de tests de controller que el resto de la API. No toca código
de producción; si un caso falla, documenta el fallo en el PR y deja el test
rojo con `it.fails` y una nota.

Done when: el spec existe, cubre todas las rutas de la tabla de *Interfaces* y
pasa.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 1.5h
- **Reason**: Tests de seguridad; tienen que ser exhaustivos.
- **Dependencies**: F6.3.T2
- **Files**:
  - `apps/api/src/group-sessions/group-sessions.access.spec.ts`

## F6.4 — Package: push de convocatoria

### F6.4.T1 — notifyGroupSessionStarted

En `apps/api/src/push/push.service.ts`, añadir
`notifyGroupSessionStarted({ sessionId, groupId, initiatorId, initiatorName, topic }): Promise<void>`.
Envía, con el `sendTo` privado existente, a todos los miembros del grupo menos
el iniciador (`GroupsRepository.listMembers`).

En `apps/api/src/push/push.messages.ts`:
- Suma `'group_session' | 'group_message'` a `PushKind`.
- Añade el builder i18n (es, en y pt, igual que los mensajes existentes):
  título "Sesión grupal", cuerpo "{initiatorName} abrió una sesión grupal sobre
  {topic}", `data: { type: 'group_session', route: '/group-session/{sessionId}' }`.

Sin throttle: FR-4 ya limita a una sala activa.

Done when: `push.service.spec.ts` comprueba los destinatarios (sin el iniciador),
la ruta y el idioma por locale.

- **Model**: agy/gemini-3.8-flash-medium
- **Estimate**: 1h
- **Reason**: Copia del patrón de notifyChallenge; trabajo mecánico.
- **Dependencies**:
- **Files**:
  - `apps/api/src/push/push.service.ts`
  - `apps/api/src/push/push.messages.ts`
  - `apps/api/src/push/push.service.spec.ts`

## F6.5 — Package: app, sala por texto

### F6.5.T1 — Capa de datos de la sesión grupal en la app

Crear `apps/mobile/lib/features/group_session/data/` y `domain/`.

En los modelos freezed para `GroupSessionDto`, `ParticipantDto`,
`GroupMessageDto`, `GroupCorrectionDto`, `GroupSessionDetailDto` y
`GroupRecapDto`, copia los campos exactos de *Interfaces* de la arquitectura.

`GroupSessionApi` (usando `apps/mobile/lib/core/http/api_client.dart`) cubre
todos los endpoints de texto: `start`, `active`, `detail`, `join`, `leave`,
`end`, `sendMessage` y `setShareCorrections`. Mapea los códigos
`GROUP_SESSION_ACTIVE` (devolviendo el id existente), `GROUP_SESSION_ENDED`,
`NOT_PARTICIPANT` y `GROUP_SESSION_FORBIDDEN`.

`GroupRoomStream` abre `GET group-sessions/:id/events`:
- Reutiliza la técnica de `sendTurnStream` en
  `apps/mobile/lib/core/api/http_fluent_api.dart` (Dio `ResponseType.stream` +
  `LineSplitter`) y emite un `Stream<RoomEvent>` tipado. Ignora los `: ping`.
- Si la conexión cae: backoff 1 s, 2 s, 5 s; luego pide `detail()` de nuevo y
  vuelve a abrir el stream.

`GroupSessionController` (Riverpod `Notifier`) guarda el estado de la sala:
- Funde el snapshot y los eventos, deduplicando por `id` y por `clientId` (un
  mensaje propio optimista se sustituye al llegar el `message` con el mismo
  `clientId`).
- Acumula `tutor_token` en un mensaje del tutor "en curso".

Done when: hay tests de los modelos (JSON de ida y vuelta), del parser del
stream (eventos, ping, reconexión con un Dio falso) y de la deduplicación del
controller. `flutter analyze` queda limpio.

- **Model**: agy/gemini-3.1-pro-high
- **Estimate**: 4h
- **Reason**: Flutter con streams y estado; tier alto de Gemini, fuerte en Dart.
- **Dependencies**:
- **Files**:
  - `apps/mobile/lib/features/group_session/data/`
  - `apps/mobile/lib/features/group_session/domain/`
  - `apps/mobile/test/features/group_session/data/`
  - `apps/mobile/test/features/group_session/domain/`

### F6.5.T2 — Pantalla de sala, entrada desde el grupo y deep link

**`GroupSessionScreen`** (`apps/mobile/lib/features/group_session/presentation/`):
- Lista de mensajes: los propios a la derecha; los ajenos con avatar y nombre;
  los de sistema como línea centrada diferenciada (FR-14).
- Cabecera con tema, participantes y un temporizador hasta `endsAt`.
- Campo de texto y botones "Salir" y "Terminar" (este último solo para el
  iniciador).
- Al terminar la sala muestra "sesión terminada" y desactiva el input (FR-5).
- Al entrar llama a `join` si el usuario no es participante activo.

**`GroupScreen`** (`apps/mobile/lib/features/group/presentation/group_screen.dart`):
tarjeta "Sesión grupal":
- Si hay sala activa (`active()`), muestra "en curso" con el tema y el
  iniciador y el botón "Unirse".
- Si no la hay, muestra "Iniciar" y abre un selector de tipo (tema libre,
  roleplay o noticia), reutilizando los catálogos que ya usa
  `features/session/presentation/new_session_screen.dart`.
- Si iniciar devuelve 409, entra en la sala existente (FR-4).

**Ruta y deep link**:
- Añade la ruta `/group-session/:id` en `apps/mobile/lib/app/router.dart`.
- En `apps/mobile/lib/core/push/push_service.dart`, `_safeRoute` debe aceptar
  `/group-session/<uuid>`, validado con una regex y no por prefijo libre.
- Textos nuevos en `apps/mobile/lib/l10n/app_es.arb` y `app_pt.arb` (y en el
  `en` base si existe).

Done when: hay widget tests de la pantalla (mensaje propio, ajeno y de sistema;
input desactivado al terminar) y de la tarjeta del grupo (con y sin sala), y un
test de `_safeRoute` que acepta `/group-session/<uuid>` y rechaza
`/group-session/../x`. `flutter analyze` queda limpio.

- **Model**: agy/gemini-3.1-pro-high
- **Estimate**: 4h
- **Reason**: UI Flutter con varias piezas; Gemini Pro rinde bien en layout de widgets.
- **Dependencies**: F6.5.T1
- **Files**:
  - `apps/mobile/lib/features/group_session/presentation/`
  - `apps/mobile/lib/features/group/presentation/group_screen.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/core/push/push_service.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/group_session/presentation/`
  - `apps/mobile/test/features/group/group_screen_test.dart`
  - `apps/mobile/test/core/push/push_service_test.dart`
