---
type: spec
project_id: fluent
phase: 9
version: 0.1
depends_on:
  - docs/arch/002-sesion-grupal.md
  - docs/prd/002-sesion-grupal.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-06
title: Progreso de la sesión grupal
---

# F9 — Progreso de la sesión grupal

Al cerrar la sala, cada participante obtiene:
- XP y streak.
- Una fila en su historial.
- Su brief actualizado solo con errores, sin hechos personales.

La sala recibe además un recap del tutor.

Arquitectura: `docs/arch/002-sesion-grupal.md`, secciones *Cierre y progreso*,
*Brief solo con errores*, *Historial*, *Data model* (`close_group_session`,
`advance_streak`) y las decisiones D2, D7 y D8. PRD: FR-15 a FR-18.

Contexto del repo:
- XP y streak se calculan en SQL, en `close_session`
  (`apps/api/migrations/20260908190806_sesiones-turnos-correcciones.sql`).
- El leaderboard suma `xp_events`.
- El brief lo actualiza `CoachingBriefService.run(sessionId)` con el RPC
  `apply_brief`.

## F9.1 — Package: cierre con XP

### F9.1.T1 — advance_streak y close_group_session

Migración `apps/api/migrations/20261006130000_cierre-sesion-grupal.sql`.

**`advance_streak`**
- Extrae el bloque de streak de `close_session` (el cálculo de `v_streak`, el
  bonus `streak_7` y la actualización de `profiles.streak` /
  `longest_streak`) a
  `advance_streak(p_user_id uuid, p_ended_at timestamptz) RETURNS jsonb`, que
  devuelve `{streak, bonus}`.
- Reescribe `close_session` para usarlo sin cambiar el comportamiento:
  `apps/api/migrations/tests/close_session.sql` tiene que pasar intacto.

**`close_group_session(p_session_id uuid, p_reason text) RETURNS jsonb`**, como
lo describe *Data model*:
- Marca la sala `ended` y cierra la presencia sumando `present_sec`.
- Por cada participante con `messages_count ≥ 1`:
  - Inserta en `sessions` (`kind = 'group'`, `group_session_id`,
    `status = 'ended'`, `duration_sec = present_sec`,
    `turns_count = messages_count`, `xp_earned`).
  - Calcula `xp = least(messages_count*5, 60) + least(floor(present_sec/60)*2, 30)`.
  - Inserta `xp_events(kind = 'group')`.
  - Si `messages_count ≥ 5`, llama a `advance_streak` e inserta el bonus
    `streak_7` si lo hay.
- Devuelve `[{userId, sessionId, xp, streak}]`.
- Es idempotente: una segunda llamada devuelve lo mismo sin duplicar filas.
- `REVOKE ... FROM PUBLIC, anon, authenticated`.

Test `apps/api/migrations/tests/close_group_session.sql`, que cubra:
- 3 participantes (0, 3 y 6 mensajes): solo 2 filas `sessions`, y solo el de 6
  avanza el streak.
- Los topes de XP.
- La idempotencia.

Done when: los dos tests SQL pasan.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 3h
- **Reason**: Refactor de una función SQL de XP en producción más una nueva; premium por riesgo de regresión.
- **Dependencies**: F6.1.T1
- **Files**:
  - `apps/api/migrations/20261006130000_cierre-sesion-grupal.sql`
  - `apps/api/migrations/tests/close_group_session.sql`

### F9.1.T2 — GroupCloser reemplaza el cierre provisional

**`GroupCloser.close(sessionId, reason)`** en
`apps/api/src/group-sessions/group-closer.service.ts`:
1. Llama al RPC `close_group_session`. Añade su tipo en
   `apps/api/src/db/rpc.ts` y las constantes `GROUP_XP_PER_MESSAGE = 5`,
   `GROUP_XP_MESSAGES_CAP = 60`, `GROUP_XP_PER_PRESENT_MIN = 2`,
   `GROUP_XP_PRESENCE_CAP = 30` y `GROUP_STREAK_MIN_MESSAGES = 5` en
   `apps/api/src/config/product.ts`, con un comentario que apunte a la
   migración.
2. Inserta el mensaje de sistema `ended` y publica `ended` con
   `xp: [{userId, xp}]`.
3. Para cada fila `sessions` con `turns_count ≥ MIN_TURNS_FOR_BRIEF`, llama a
   `JobDispatcher.enqueueCoachingBrief(sessionId)`.
4. Llama a `award_badges` igual que `SessionCloserService`
   (`apps/api/src/sessions/session-closer.service.ts`).

`GroupSessionsService.close` (el provisional de F6.3.T1) pasa a delegar en
`GroupCloser`; el sweeper y `POST end` siguen llamando a `close`.

Done when: el spec de `group-closer` cubre el evento `ended` con XP, el brief
encolado solo para quien llegó al mínimo y que una segunda llamada no duplica
eventos.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Orquestación sobre un RPC ya probado.
- **Dependencies**: F9.1.T1, F8.3.T1, F8.2.T1
- **Files**:
  - `apps/api/src/group-sessions/group-closer.service.ts`
  - `apps/api/src/group-sessions/group-closer.service.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.service.ts`
  - `apps/api/src/group-sessions/group-sessions.module.ts`
  - `apps/api/src/db/rpc.ts`
  - `apps/api/src/config/product.ts`

### F9.1.T3 — Excluir 'group' de las consultas que asumen 1:1

Desde F9.1.T1 existen filas `sessions.kind = 'group'`. Revisar y, donde no
aplique, excluir `'group'`:
- `listCandidateSessionsForMembers` (desafíos) en
  `apps/api/src/sessions-query/sessions-query.repository.ts`.
- `listTopicsSince`.
- La lógica de `next_is_boss` / boss.
- Cualquier lectura de `turns` por `session_id` que reciba una sesión `group`
  (que no tiene turns).

`countValidSessionsSince` **sí** cuenta los grupos (resumen semanal como conteo,
D8).

Deja la lista de consultas revisadas, con lo decidido para cada una, en la
descripción del PR.

Done when: cada consulta cambiada tiene un test con una fila `group` que prueba
la exclusión, y `countValidSessionsSince` tiene uno que prueba que la incluye.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Auditoría transversal; requiere leer bien el código existente.
- **Dependencies**: F9.1.T1
- **Files**:
  - `apps/api/src/sessions-query/sessions-query.repository.ts`
  - `apps/api/src/sessions-query/sessions-query.repository.spec.ts`
  - `apps/api/src/sessions/scenario.ts`

## F9.2 — Package: recap

### F9.2.T1 — Recap del tutor al cerrar

**Esquema.** `GroupRecapOutput` en `apps/api/src/llm/schemas.ts`, según
*Interfaces → LLM*: hasta 5 `topics` y un `highlight` por participante con
mensajes, en inglés (D7).

**Prompt.** `apps/api/src/llm/prompts/group-recap.ts`: recibe los mensajes y los
participantes; sin brief ni hechos.

**Job `group-recap`** en `apps/api/src/jobs/group-recap/`, registrado en la cola
`group` dentro de `apps/api/src/worker.module.ts`:
- Cobra con `DailyTurnsBudget.consume` al **iniciador** (D6). Si no tiene cupo,
  no hay recap y no pasa nada más.
- Usa el modelo del iniciador y `purpose: 'group_recap'`.
- Guarda en `group_sessions.recap` y publica `recap`.
- Descarta los `highlights` cuyo `userId` no sea participante.

`GroupCloser.close` lo encola con `jobId: recap:{sessionId}`.

Done when: los specs cubren el recap guardado y publicado, el iniciador sin
cupo (sin recap) y el filtrado de un `highlight` con usuario desconocido.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Llamada LLM nueva sobre la infraestructura de F7.
- **Dependencies**: F9.1.T2, F7.3.T2
- **Files**:
  - `apps/api/src/llm/schemas.ts`
  - `apps/api/src/llm/prompts/group-recap.ts`
  - `apps/api/src/llm/prompts/group-recap.spec.ts`
  - `apps/api/src/jobs/group-recap/`
  - `apps/api/src/worker.module.ts`
  - `apps/api/src/group-sessions/group-closer.service.ts`

## F9.3 — Package: brief solo con errores

### F9.3.T1 — Variante de grupo del coaching brief

En `CoachingBriefService.run(sessionId)`
(`apps/api/src/jobs/coaching-brief/coaching-brief.service.ts`), cuando la
sesión tiene `kind = 'group'`:
- Carga, a través de `group_session_id`, solo los mensajes `role = 'user'` de
  `sessions.user_id` y sus `group_session_corrections`.
- Usa una variante de `buildBriefMessages` (`apps/api/src/llm/prompts/brief.ts`)
  que recibe el brief anterior y esas correcciones y **no** pide `facts`, con un
  esquema sin `facts` o con `facts` forzado a `[]`.
- Llama a `apply_brief` con `p_facts = []` (FR-18, NFR-3).

El camino 1:1 no cambia.

Done when: los specs comprueban que la sesión `group` produce brief y errores
recurrentes, que `apply_brief` recibe `p_facts = []`, que el prompt no contiene
mensajes de otros participantes y que los specs 1:1 existentes siguen verdes.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Toca datos personales y privacidad del brief.
- **Dependencies**: F9.1.T2
- **Files**:
  - `apps/api/src/jobs/coaching-brief/`
  - `apps/api/src/llm/prompts/brief.ts`

## F9.4 — Package: historial y cierre en la app

### F9.4.T1 — Detalle de historial para sesiones de grupo

En `apps/api/src/sessions/sessions-history.service.ts` y
`apps/api/src/sessions/sessions-history.repository.ts`:
- `GET sessions` ya lista las filas `group` del usuario. Añade al ítem `kind`
  y, para `group`, el tema y los nombres de los demás participantes.
- `GET sessions/:id` con `kind = 'group'` devuelve los mensajes de la sala
  (`GroupMessageDto[]`), las correcciones visibles para ese usuario (las suyas
  más las de autores que compartieron), el `recap` y su XP.

Solo el dueño de la fila `sessions` puede verla, lo que ya garantiza
`findOwnedSessionOrThrow` (FR-17).

Done when: los specs cubren el listado con una fila `group`, el detalle con
correcciones filtradas y que otro usuario no puede ver la fila ajena.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Lectura con filtro de privacidad sobre servicios existentes.
- **Dependencies**: F9.1.T2
- **Files**:
  - `apps/api/src/sessions/sessions-history.service.ts`
  - `apps/api/src/sessions/sessions-history.repository.ts`
  - `apps/api/src/sessions/sessions-history.service.spec.ts`

### F9.4.T2 — App: pantalla de cierre con XP y recap, e historial de grupo

**Cierre.** En `apps/mobile/lib/features/group_session/presentation/`, al
recibir `ended` se muestra la pantalla de cierre: la XP de cada participante
(con la propia destacada) y, cuando llega `recap`, los temas y una frase por
persona. Hasta entonces, un placeholder.

**Historial.** En la lista de `apps/mobile/lib/features/session/presentation/`
(o donde se pinte el historial), un ítem `kind = 'group'` lleva icono de grupo y
abre la sala en solo lectura: mensajes, correcciones visibles y recap, usando
`GET sessions/:id`. Añade los campos nuevos a los modelos de
`apps/mobile/lib/core/api/models.dart`.

Textos l10n en `app_es.arb` y `app_pt.arb`.

Done when: hay widget tests del cierre (XP y luego recap) y de la vista en solo
lectura desde el historial. `flutter analyze` queda limpio.

- **Model**: agy/gemini-3.1-pro-high
- **Estimate**: 3h
- **Reason**: UI Flutter sobre contratos ya fijados.
- **Dependencies**: F9.4.T1, F9.2.T1, F8.1.T2
- **Files**:
  - `apps/mobile/lib/features/group_session/presentation/`
  - `apps/mobile/lib/features/session/presentation/`
  - `apps/mobile/lib/core/api/models.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/group_session/`
