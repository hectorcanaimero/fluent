---
type: spec
project_id: fluent
phase: 8
version: 0.1
depends_on:
  - docs/arch/002-sesion-grupal.md
  - docs/prd/002-sesion-grupal.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-06
title: Voz y push de mensajes en la sesión grupal
---

# F8 — Voz y push de mensajes

Notas de voz de hasta 60 s, transcritas en el dispositivo, con audio que los
demás pueden reproducir, y push agrupado para quien no está mirando la sala.

Arquitectura: `docs/arch/002-sesion-grupal.md`, secciones *VoiceNotes*,
*GroupPush*, *Risks* (micrófono compartido) y *Decisions* D5 y D9. PRD: FR-7,
FR-8 y NFR-5.

Contexto del repo:
- `apps/api` es NestJS 12 en ESM, con vitest y `@insforge/sdk` con cliente
  admin.
- `apps/mobile` es Flutter con Riverpod. El STT nativo es `speech_to_text`
  (`features/session/data/speech_service.dart`). No hay paquete de grabación
  ni de reproducción de audio.

## F8.1 — Package: app, nota de voz

### F8.1.T1 — Grabador con transcripción simultánea y degradación

Crear `apps/mobile/lib/features/group_session/data/voice_note_recorder.dart`.
Graba con el paquete `record` (AAC/m4a, mono, 64 kbps, corte duro a 60 s) y, a
la vez, transcribe con `SpeechToTextService` en inglés.

**Riesgo conocido (arquitectura, *Risks*):** Android puede no permitir dos
capturas de micrófono simultáneas. Si `record` o el STT fallan al arrancar
mientras el otro está activo, el grabador **degrada a solo transcripción**:
devuelve `VoiceNote(transcript, audioPath: null)` y expone
`audioSupported = false` para el resto de la sesión.

`VoiceNote { String transcript; String? audioPath; int durationMs; }`.

En `apps/mobile/pubspec.yaml`, añadir `record` y `just_audio` (este último para
F8.1.T2). Permisos:
- `NSMicrophoneUsageDescription` en `apps/mobile/ios/Runner/Info.plist`, si no
  está ya por el STT.
- `RECORD_AUDIO` en `apps/mobile/android/app/src/main/AndroidManifest.xml`.

Escribe en la descripción del PR qué pasó en un dispositivo Android real si el
agente puede probarlo; si no, deja la casilla "probar en dispositivo" para la
persona que revisa.

Done when: tests unitarios con `record` y STT falsos cubren los dos funcionando
(audio + transcripción), `record` fallando (degrada, sin audio) y el corte a
60 s. `flutter analyze` queda limpio.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Integración nativa con un riesgo real de plataforma y una ruta de degradación; mejor Claude que un modelo rápido.
- **Dependencies**: F6.5.T1
- **Files**:
  - `apps/mobile/lib/features/group_session/data/voice_note_recorder.dart`
  - `apps/mobile/test/features/group_session/data/voice_note_recorder_test.dart`
  - `apps/mobile/pubspec.yaml`
  - `apps/mobile/ios/Runner/Info.plist`
  - `apps/mobile/android/app/src/main/AndroidManifest.xml`

### F8.1.T2 — UI de nota de voz: grabar, revisar, enviar y reproducir

En la sala (`apps/mobile/lib/features/group_session/presentation/`):

**Grabar.** Mantener pulsado el micrófono graba con `VoiceNoteRecorder`
(F8.1.T1); al soltar se abre la revisión.

**Revisar.** Hoja con la transcripción editable (como RF-3.1), la duración y los
botones "Enviar" y "Descartar".

**Enviar.** Añadir `sendVoiceMessage(audioPath?, transcript, durationMs, clientId)`
a `GroupSessionApi` (`features/group_session/data/`):
- Con audio, hace multipart a `POST group-sessions/:id/voice-messages`.
- Sin audio (modo degradado), envía la transcripción por `sendMessage` normal.

**Reproducir.** Un mensaje con `hasAudio` muestra un mini reproductor
(`just_audio`) que descarga `GET .../messages/:messageId/audio` con el token del
`api_client`. Un `410` muestra "audio caducado" y deja solo el texto.

Textos l10n en `app_es.arb` y `app_pt.arb`.

Done when: hay widget tests de la hoja de revisión (editar y enviar llama a la
API correcta en ambos modos) y del mensaje con audio (reproductor visible; 410
da el texto de caducado). `flutter analyze` queda limpio.

- **Model**: agy/gemini-3.1-pro-high
- **Estimate**: 3h
- **Reason**: UI Flutter con un contrato claro.
- **Dependencies**: F8.1.T1, F7.4.T1
- **Files**:
  - `apps/mobile/lib/features/group_session/presentation/`
  - `apps/mobile/lib/features/group_session/data/group_session_api.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/group_session/presentation/`

## F8.2 — Package: API, notas de voz

### F8.2.T1 — Bucket group-voice, subida y descarga

En `apps/api/src/group-sessions/voice/` (controller + service, registrados en
`group-sessions.module.ts`):

**Subida**: `POST group-sessions/:id/voice-messages`, multipart con `audio`,
`transcript`, `durationMs` y `clientId`.
- Mismas comprobaciones de grupo y participación que `POST messages`.
- Valida `durationMs ≤ 60000`, tamaño ≤ 2 MB y mime `audio/mp4`, `audio/m4a`
  o `audio/aac`; si no cumple, `400`.
- Sube con `admin.storage.from('group-voice')` usando la clave
  `{sessionId}/{uuid}.m4a`.
- Llama a `GroupSessionsService.postUserMessage(..., { text: transcript, audioKey, audioMs })`
  (F6.3.T2), así el tutor y el push se disparan igual que con el texto.
- Si la inserción falla, borra el objeto subido.

**Descarga**: `GET group-sessions/:id/messages/:messageId/audio`.
- Mismas comprobaciones de grupo, más ser o haber sido participante.
- Hace stream del objeto con `Content-Type: audio/mp4`.
- Si `audio_key` es null, `410`.

Que el bucket sea privado: si InsForge lo crea por migración o por API,
documenta el paso en `apps/api/README.md` o donde se documenten los otros
buckets (`badges`).

Done when: los specs cubren la subida válida (objeto subido y mensaje creado con
`audioKey`), el audio de más de 60 s o 2 MB (400), quien no es participante
(403), el fallo de inserción (borra el objeto) y la descarga con `audio_key`
null (410).

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Subida de archivos con control de acceso y limpieza ante fallos.
- **Dependencies**: F6.3.T2, F7.3.T1
- **Files**:
  - `apps/api/src/group-sessions/voice/`
  - `apps/api/src/group-sessions/group-sessions.module.ts`
  - `apps/api/README.md`

### F8.2.T2 — Retención de audio a 30 días

En `apps/api/src/jobs/maintenance/retention.service.ts`, añadir un paso al job
diario. Busca los mensajes con `audio_key IS NOT NULL` y
`created_at < now() - 30 days`, borra el objeto del bucket `group-voice` y pone
`audio_key = null`; la transcripción (`text`) se queda (NFR-5). Procesa en lotes
de 200. Si borrar un objeto falla, registra el error y sigue con el resto sin
anular su `audio_key`.

Done when: el spec cubre que se borra el audio viejo, se respeta el reciente y
un fallo de borrado de un objeto no detiene el lote.

- **Model**: agy/gemini-3.8-flash-medium
- **Estimate**: 1h
- **Reason**: Un paso más en un job de retención existente; mecánico.
- **Dependencies**: F8.2.T1
- **Files**:
  - `apps/api/src/jobs/maintenance/retention.service.ts`
  - `apps/api/src/jobs/maintenance/retention.service.spec.ts`

## F8.3 — Package: push de mensajes

### F8.3.T1 — notifyGroupMessage con presencia y throttle

En `apps/api/src/push/push.service.ts`, añadir
`notifyGroupMessage({ sessionId, authorId, authorName, preview })`.

Destinatarios: los participantes activos (`left_at IS NULL`) menos el autor y
menos los que estén en `RoomBus.onlineUsers(sessionId)`. Para cada uno, solo
envía si `SET push:gs:{sessionId}:{userId} 1 NX EX 60` tiene éxito (D5: como
mucho uno por minuto por usuario y sala).

Mensaje i18n en `apps/api/src/push/push.messages.ts`:
- Tipo `group_message` y ruta `/group-session/{sessionId}`.
- El cuerpo es "{authorName}: {preview}" con `preview` truncado a 80
  caracteres; para el tutor, "Tutor".

Llama a `notifyGroupMessage` sin bloquear en dos sitios:
- `GroupSessionsService.postUserMessage`.
- La publicación del mensaje del tutor, en el procesador de F7.3.T2
  (`apps/api/src/jobs/group-tutor/`).

Done when: `push.service.spec.ts` comprueba que 5 mensajes en 30 s dan una sola
notificación por destinatario, que un usuario online no recibe nada, que el
autor no se notifica a sí mismo y que el que salió no recibe nada.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 2h
- **Reason**: Toca push, presencia y dos productores; requiere cuidado con los destinatarios.
- **Dependencies**: F6.4.T1, F7.3.T2, F6.2.T1
- **Files**:
  - `apps/api/src/push/push.service.ts`
  - `apps/api/src/push/push.messages.ts`
  - `apps/api/src/push/push.service.spec.ts`
  - `apps/api/src/group-sessions/group-sessions.service.ts`
  - `apps/api/src/jobs/group-tutor/`
