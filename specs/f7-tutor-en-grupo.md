---
type: spec
project_id: fluent
phase: 7
version: 0.1
depends_on:
  - docs/arch/002-sesion-grupal.md
  - docs/prd/002-sesion-grupal.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-06
title: El tutor en el grupo
---

# F7 — El tutor en el grupo

El tutor entra en la sala de F6:
- Abre la conversación y modera.
- Responde por mención, cada N mensajes o cuando la conversación se estanca.
- En la misma llamada corrige los mensajes acumulados.
- Las correcciones son privadas salvo que el autor las comparta.
- Ajusta su registro al nivel más bajo de los presentes.

Arquitectura: `docs/arch/002-sesion-grupal.md`, secciones *TutorScheduler +
GroupTutorProcessor*, *Prompt de grupo*, *DailyTurnsBudget* e *Interfaces →
LLM / Jobs*. PRD: FR-9 a FR-13, NFR-1 a NFR-4.

Contexto del repo:
- `apps/api` es NestJS 12 en ESM, con vitest e imports `.js`.
- Las llamadas LLM van por `LlmService.complete({ schema, purpose, plan, preference, onToken })`
  (`apps/api/src/llm/llm.service.ts`).
- Los jobs son de BullMQ (`apps/api/src/jobs`) y corren en `apps/api/src/worker.ts`.

## F7.1 — Package: prompt de grupo

### F7.1.T1 — buildGroupTurnMessages y GroupTurnOutput

**Esquemas.** En `apps/api/src/llm/schemas.ts`, añade `GroupTurnOutput` tal como
lo fija *Interfaces → LLM*: `reply` de hasta 1200 caracteres y como mucho 6
`corrections`, cada una con `messageId`, `original`, `corrected`, `category` (el
enum `CATEGORIES` existente) y `note` de hasta 140 caracteres.

**Prompt.** En `apps/api/src/llm/prompts/group-turn.ts`, exporta:
- `GroupTurnPromptInput`.
- `buildGroupTurnMessages(input)`.
- Las funciones puras `quietParticipants(messages, participants)`: los
  participantes activos sin mensaje entre los últimos 4 mensajes de usuario
  (FR-9).
- `minLevel(levels)`: el CEFR más bajo de los presentes (FR-13).

El system prompt tiene que:
- Reutilizar el escenario de `apps/api/src/sessions/scenario.ts`
  (`rebuildScenario`).
- Presentar al tutor como moderador de un grupo de amigos.
- Pedirle que mencione por nombre a cada participante de `quietParticipants`.
- Fijar el techo de vocabulario en `minLevel` + 1 (A2 → como mucho B1).
- Escribir cada `note` en el `locale` del autor de ese mensaje.
- Corregir solo mensajes `role = 'user'` cuyo `id` aparezca en el input, sin
  inventar ids.
- Ajustar la instrucción a `trigger`: `open` saluda y lanza la primera pregunta;
  `stall` reanima la conversación.

**No** se inyectan brief, hechos ni errores recurrentes (NFR-3). Sigue el estilo
de `apps/api/src/llm/prompts/turn.ts`.

Done when:
- `group-turn.spec.ts` cubre `quietParticipants` (3 personas, una callada en los
  últimos 4) y `minLevel`.
- Un snapshot del prompt con `trigger` distinto en cada caso muestra que no
  contiene texto de brief ni de hechos.
- Hay casos nuevos en el banco de prompts del repo (busca dónde viven los de
  `turn`) para A2 + B2: respuesta sin vocabulario por encima de B1.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 3h
- **Reason**: El prompt es el corazón de la calidad pedagógica del grupo; premium.
- **Dependencies**:
- **Files**:
  - `apps/api/src/llm/prompts/group-turn.ts`
  - `apps/api/src/llm/prompts/group-turn.spec.ts`
  - `apps/api/src/llm/schemas.ts`

## F7.2 — Package: tope diario compartido

### F7.2.T1 — Extraer DailyTurnsBudget de TurnsService

Mover la lógica de `requireDailyTurnsBudget` (privada en
`apps/api/src/sessions/turns.service.ts`) a un provider inyectable
`DailyTurnsBudget` en `apps/api/src/sessions/daily-turns-budget.ts`, con
`consume(userId, plan, tz): Promise<void>`. Mantiene:
- La clave Redis `turns:day:{userId}:{día}` (`sessions/user-day.ts`).
- El TTL hasta la medianoche del usuario.
- Los topes `TURNS_DAILY_CAP_FREE` y `TURNS_DAILY_CAP_PRO`.
- El `429 TURNS_DAILY_CAP` y el fail-open si Redis cae.

`TurnsService` pasa a usar el provider. Expórtalo desde
`apps/api/src/sessions/sessions.module.ts` para que el worker lo use.

El 1:1 no cambia de comportamiento: los specs existentes de `turns.service`
deben pasar sin modificar las aserciones.

Done when: `daily-turns-budget.spec.ts` cubre bajo tope, en el tope (429), plan
Pro y Redis caído, y los specs de `turns.service` siguen verdes.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 1.5h
- **Reason**: Refactor con riesgo de regresión en cobro de turnos.
- **Dependencies**:
- **Files**:
  - `apps/api/src/sessions/daily-turns-budget.ts`
  - `apps/api/src/sessions/daily-turns-budget.spec.ts`
  - `apps/api/src/sessions/turns.service.ts`
  - `apps/api/src/sessions/sessions.module.ts`

## F7.3 — Package: scheduler y procesador del tutor

### F7.3.T1 — Cola group y disparadores del tutor

En `apps/api/src/jobs/jobs.constants.ts`, añadir la cola `group` y los nombres
de job `group-tutor` y `group-recap`.

`TutorScheduler` (`apps/api/src/group-sessions/tutor/tutor-scheduler.ts`)
expone dos métodos:

**`onSessionStarted(sessionId, initiatorId)`** encola
`group-tutor {trigger: 'open', triggeredBy: initiatorId}`.

**`onUserMessage(sessionId, messageId, authorId, text)`**:
- `INCR gs:{id}:since_tutor`.
- Si `text` contiene `@tutor` (sin distinguir mayúsculas), encola
  `trigger: 'mention'`.
- Si no, y el contador llegó a `GROUP_TUTOR_EVERY_N` (constante nueva en
  `apps/api/src/config/product.ts`, valor 3), encola `trigger: 'every_n'`.
- Siempre añade además el job diferido `trigger: 'stall'` con
  `delay: GROUP_TUTOR_STALL_MS` (60000) y `jobId: stall:{sessionId}:{messageId}`.
- El job normal usa `jobId: tutor:{sessionId}:{messageId}` y
  `triggeredBy = authorId`.

Conecta el scheduler en `apps/api/src/group-sessions/group-sessions.service.ts`:
`start` llama a `onSessionStarted` y `postUserMessage` a `onUserMessage`, ambos
sin bloquear la respuesta HTTP.

Done when: `tutor-scheduler.spec.ts`, con una Queue falsa, comprueba que:
- 3 mensajes seguidos encolan exactamente un `every_n`.
- `@Tutor` encola `mention` en el primer mensaje.
- Cada mensaje programa su `stall` con el jobId correcto.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Lógica de cadencia (FR-10) con contadores Redis.
- **Dependencies**: F6.3.T2, F6.3.T3
- **Files**:
  - `apps/api/src/group-sessions/tutor/tutor-scheduler.ts`
  - `apps/api/src/group-sessions/tutor/tutor-scheduler.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.service.ts`
  - `apps/api/src/group-sessions/group-sessions.module.ts`
  - `apps/api/src/jobs/jobs.constants.ts`
  - `apps/api/src/config/product.ts`

### F7.3.T2 — GroupTutorProcessor: lock, cobro, LLM, streaming y persistencia

Procesador BullMQ de `group-tutor` en `apps/api/src/jobs/group-tutor/`
(processor + module), registrado en `apps/api/src/worker.module.ts` con
concurrencia 6. Por job, en este orden:

1. Carga la sala. Si está `ended`, termina sin hacer nada.
2. **Estancamiento**: con `trigger = 'stall'`, sigue solo si el `messageId` del
   jobId sigue siendo el último mensaje `user` de la sala.
3. **Lock**: `SET gs:{id}:tutor NX PX 30000`. Si no lo obtiene, termina, porque
   el turno en curso ya cubrirá estos mensajes.
4. **Cobro**: `DailyTurnsBudget.consume(triggeredBy, …)` (F7.2.T1). Si devuelve
   429, inserta y publica el mensaje de sistema `tutor_unavailable`, suelta el
   lock y termina (D6).
5. **Modelo**: plan y preferencia del **iniciador** (`effectivePlan`,
   `model_preferences`), según NFR-2.
6. **Llamada**: arma el input con los últimos 20 mensajes, los participantes
   activos con su nivel y locale, `quietParticipants` y `minLevel` (F7.1.T1), y
   llama a `LlmService.complete({ schema: GroupTurnOutput, purpose: 'group_turn', onToken })`.
   Cada token se publica como `tutor_token` por RoomBus.
7. **Persistencia**: guarda el mensaje `role = 'tutor'` (modelo, tokens,
   latencia) y las correcciones válidas en `group_session_corrections`. Se
   descarta cualquier corrección cuyo `messageId` no sea un mensaje `user` de
   la sala.
8. **Publicación**: publica `message`, y luego un evento `corrections` por
   autor, con `authorId`.
9. **Reset**: `DEL gs:{id}:since_tutor`, actualiza `last_message_at` y suelta
   el lock.

Añade `'group_turn'` y `'group_recap'` a los `purpose` aceptados por
`llm_calls`, si ese campo tiene un enum o check.

Done when: `group-tutor.processor.spec.ts`, con LlmService, Redis y bus falsos,
cubre estos casos:
- Sala `ended`: no hace nada.
- `stall` obsoleto: no hace nada.
- Lock ocupado: no hace nada.
- Sin cupo: publica `tutor_unavailable`.
- Turno normal: tokens publicados, mensaje y correcciones guardados.
- Corrección con id ajeno: se descarta.
- Plan del iniciador: se usa aunque haya disparado un Free.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 4h
- **Reason**: Concurrencia, cobro y privacidad juntas; la pieza más delicada de la fase.
- **Dependencies**: F7.3.T1, F7.1.T1, F7.2.T1
- **Files**:
  - `apps/api/src/jobs/group-tutor/`
  - `apps/api/src/worker.module.ts`
  - `apps/api/src/group-sessions/group-sessions.repository.ts`
  - `apps/api/src/db/schema.ts`

## F7.4 — Package: app, tutor y correcciones

### F7.4.T1 — Tutor en streaming, chips de corrección y toggle de compartir

En `apps/mobile/lib/features/group_session/`:

**Tutor.**
- Burbuja propia con avatar del tutor.
- Muestra `tutor_token` mientras llega, reemplazado luego por el `message`
  final.
- TTS opcional con la misma preferencia y velocidad que el 1:1 (reutiliza el
  servicio `flutter_tts` de `features/session`).

**Mención.** Botón "@tutor" que inserta la mención en el input.

**Correcciones.**
- Chips bajo cada mensaje con el mismo widget de chip que usa
  `features/session/presentation/conversation_screen.dart` (RF-3.4).
- El usuario ve los suyos siempre y los ajenos cuando le llegan, ya que el
  servidor filtra.
- El snapshot (`detail.corrections`) y el evento `corrections` se funden por
  `messageId`.

**Compartir.**
- Switch "Compartir mis correcciones" en el menú de la sala, que llama a
  `setShareCorrections` (FR-12).
- La lista de participantes marca quién comparte.

**Tutor no disponible.** El evento de sistema `tutor_unavailable` se muestra
como línea de sistema: "El tutor no puede responder: se alcanzó el tope diario
de quien escribió".

Textos l10n en `app_es.arb` y `app_pt.arb`.

Done when: hay widget tests de la burbuja en streaming (tokens y luego final),
de los chips propios visibles, del toggle que llama a la API y de la línea
`tutor_unavailable`. `flutter analyze` queda limpio.

- **Model**: agy/gemini-3.1-pro-high
- **Estimate**: 3h
- **Reason**: UI Flutter sobre la capa de F6.5; reutiliza widgets existentes.
- **Dependencies**: F6.5.T2
- **Files**:
  - `apps/mobile/lib/features/group_session/presentation/`
  - `apps/mobile/lib/features/group_session/domain/`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/group_session/presentation/`
  - `apps/mobile/test/features/group_session/domain/`
