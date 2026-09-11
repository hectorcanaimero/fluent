# Peine fino de Fluent — app móvil y API

Fecha: 2026-09-11 · Commit auditado: `44f9193` (main) · Alcance: `apps/mobile` (Flutter, 22 251 líneas) y `apps/api` (NestJS, 17 672 líneas) · Ejes: rendimiento, UI/UX, seguridad y marketing/producto.

Método: lectura completa del código por cinco revisores independientes (UI/UX móvil, rendimiento móvil, rendimiento y arquitectura API, seguridad, producto y growth) más verificación objetiva en el VPS. Nada se ejecutó en dispositivo real; lo que depende del runtime nativo se marca como "por verificar en teléfono". Los ids `MAL-nn` y `MEJ-nn` se usan en el checklist final.

## 1. Veredicto en tres líneas

- **La base es sólida.** Arquitectura limpia en las dos apps, 904 tests en verde, sin CVEs, cripto correcta, aislamiento por usuario correcto, presupuesto de LLM respetado. Es un proyecto de dos semanas que ya parece de meses.
- **Lo que está mal es concreto y barato.** 29 problemas reales, casi todos de esfuerzo S. Los cinco que más duelen: iOS se cierra al pedir micrófono, el bearer de cada usuario acaba en los logs, la app queda "zombi" cuando caduca la sesión, la primera conversación está detrás de 11 pantallas y una salida a otra app, y la identidad visual es la plantilla de Flutter (icono, nombre, fuente).
- **Lo que hay que mejorar es sobre todo pulido:** estados de carga y error, feedback de voz, contraste, celebración, y cerrar los loops de retención (recordatorios, racha en peligro, compartir).

## 2. Verificación objetiva

| Comprobación | Resultado |
|---|---|
| `flutter analyze` | Sin avisos |
| `flutter test` | 52 tests, todos pasan |
| `oxlint` (API) | Limpio |
| `vitest` (API) | 92 archivos, 852 tests, todos pasan |
| `tsc --noEmit` (API) | Falla solo en `test/*.e2e-spec.ts`: `import { App } from 'supertest/types'` no resuelve con `moduleResolution: nodenext` |
| `pnpm audit --prod` | Sin vulnerabilidades conocidas |
| Secretos en git | `apps/api/.env` no está trackeado ni aparece en el historial |

## 3. Lo que está bien

### App móvil
- Separación de capas real: la UI solo conoce `FluentApi`; `dio` vive en `core/http` y `core/api`. STT, TTS, OAuth, share y notificaciones tienen interfaz y fake, y los tests los usan.
- Streaming SSE bien resuelto en cliente: `receiveTimeout` cero para el stream, cuerpo de error decodificado a mano, eventos desconocidos ignorados, `done` como fuente de verdad y caída al endpoint completo, con tests del parser y de la caída.
- Refresh de token con single-flight y reintento único (`core/http/api_client.dart:74-78`), sin bucles de 401.
- Seguridad básica correcta: tokens en `flutter_secure_storage`, sin `print` ni `LogInterceptor`, `defines.json` ignorado por git, sin `usesCleartextTraffic`, `code_verifier` de PKCE nunca toca el dispositivo.
- `FakeApi` se elimina del binario en release (`bool.fromEnvironment` constante).
- i18n disciplinada: todo el copy pasa por ARB, test de paridad es/pt, tono consistente (voseo en es, pt-BR nativo, no traducción literal).
- Tokens de diseño centralizados en `app/theme.dart` con los valores exactos del Pen; botones pill 56 px y tarjetas radio 20.
- Router con `computeRedirect` pura y testeada; tab bar de 4 pestañas con icono y label; perfil desde el avatar como se decidió.
- Conversación: máquina de estados clara, transcripción parcial visible, borrador editable antes de enviar, ducking del TTS al escuchar, aviso a 2 minutos, chip de "modelo alternativo", diálogo tras 3 fallos, rollback del turno con botón Repetir, fallback a texto si no hay `en_US`.
- Primer de micrófono antes del diálogo del sistema; registro tolerante (si el código falla, la cuenta queda y se puede continuar sin grupo); spinners dentro de los botones de envío.

### API
- Presupuesto de contexto respetado: últimos 8 turnos, cada uno truncado a 600 caracteres, brief a 600, 3 hechos, mensaje a 1 000 (`llm/prompts/truncate.ts`, `llm/config.ts`). Una llamada por turno, `max_tokens` 350, sin RAG.
- Parser SSE incremental defensivo (surrogates partidos, escapes, prosa antes del JSON, nunca lanza) y timeout de 25 s que cubre todo el stream.
- Fallback de modelos con máximo 3 intentos y baneo de proveedor tras 401/402/403.
- AES-256-GCM con IV aleatorio, AAD `user:provider`, rotación con `KEY_PREVIOUS`, arranque que falla si la clave no mide 32 bytes; keys nunca en respuestas ni en logs.
- Aislamiento: filtro doble `id + user_id` en todas las escrituras y `403` uniforme sin oráculo; leaderboard y desafíos usan el `group_id` del perfil, nunca un parámetro.
- RLS activado en las 13 tablas con `REVOKE ALL` previo; `SECURITY DEFINER` con `search_path` fijado; `close_session` transaccional e idempotente con `FOR UPDATE`; `UNIQUE(session_id, idx)` en turnos.
- Jobs: crons solo en el worker, ids de scheduler estables, `jobId` determinista para brief y semanal, `removeOnComplete/Fail` acotados.
- HTTP: throttling por usuario (60/min, 20/min en turnos), `ValidationPipe` con whitelist y `forbidNonWhitelisted`, filtro de errores que nunca filtra stack en producción, Swagger tras bearer de owner.
- Docker multi-stage con usuario `node`, devDeps fuera de la imagen, `HEALTHCHECK`.
- Cobertura alta: 91 specs + 11 e2e + tests SQL de las RPC.

### Producto
- La tesis está escrita y es diferencial: tutor con memoria ("¿cómo te fue en la entrevista del viernes?") más grupo de amigos. Ni Duolingo, ni ELSA, ni Speak tienen las dos cosas.
- Mecánica de juego bien pensada: sesión válida anti-farmeo (3 min y 2 turnos), tope diario, día de gracia, racha grupal que ignora a inactivos, boss battle cada 7 sesiones, desafíos cruzados sin coste de LLM.
- Privacidad como feature: "Lo que recuerdo de vos" editable, `reglas.md` dice qué ven y qué no ven los amigos, el primer explica que la transcripción se procesa en el dispositivo.
- Resumen semanal: prompt que menciona a todos, celebra al top, pincha con humor al menos activo y cierra con un desafío. Es el loop social más barato del producto.
- Contenido para no aburrir en 8 semanas: 60 temas, 30 roleplays, 40 boss topics, 24 intereses, 8 feeds.
- Observabilidad de base: `llm_calls`, `xp_events` por componente, métricas admin.

## 4. Lo que está mal

Formato: **id · título** — evidencia — impacto — solución — esfuerzo (S/M/L).

### 4.1 App móvil: bloqueantes y bugs

- **MAL-01 · iOS se cierra al pedir micrófono** — `ios/Runner/Info.plist` no tiene `NSMicrophoneUsageDescription` ni `NSSpeechRecognitionUsageDescription` — la app aborta en `speech.initialize()` y App Review rechaza el binario — añadir ambas claves con el texto de `micPermissionBody` — S.
- **MAL-02 · Sesión "zombi" cuando falla el refresh** — `core/http/api_client.dart:59` borra los tokens pero `AuthController` sigue en `authenticated`; todo da 401 y "error genérico" hasta reiniciar. Además `logout()` y borrar cuenta nunca llaman al logout remoto de InsForge (`features/auth/data/auth_controller.dart:337-340`) — exponer `onSessionExpired` en `ApiClient`, suscribir `AuthController` para pasar a `unauthenticated`, y revocar el refresh token en logout — M.
- **MAL-03 · Arrancar sin red equivale a cerrar sesión** — `_loadMe` captura cualquier error y borra tokens (`auth_controller.dart:325-328`) — modo avión, timeout o un 500 obligan a volver a loguearse — limpiar solo en 401/`unauthenticated`; en el resto conservar tokens y mostrar reintento — S.
- **MAL-04 · Bucle al cerrar una sesión restaurada** — si la app arranca con `activeSessionId`, el router manda a `/session/:id`; al terminar, "Volver" hace `go('/')` y `computeRedirect` (`app/router.dart:59-61`) vuelve a empujar a la sesión ya cerrada porque nadie refresca `/me` — en `_endSession` limpiar `activeSessionId` local o llamar `authController.refresh()` antes de navegar — S.
- **MAL-05 · El reconocimiento de voz puede quedarse en "escuchando" para siempre** — `SpeechToTextService` no registra `onStatus` ni `onError` (`features/session/data/speech_service.dart:52-61`); si el motor termina solo (45 s, `error_no_match`, llamada entrante) no llega `finalResult` y el turno no se puede enviar. Si el permiso se deniega, el diálogo dice "no tiene reconocimiento en inglés instalado", que no es la causa — manejar `onStatus` `done`/`notListening` y `onError` pasando a `reviewing` con el parcial; distinguir permiso denegado (abrir ajustes del sistema) de locale ausente — M.
- **MAL-06 · El tutor habla al doble de velocidad** — `setSpeechRate` pasa 0.8/1.0/1.2 crudos (`features/session/data/tts_service.dart:160-163`); Android multiplica por 2 e iOS usa rango 0–1 con 0.5 normal. Además la velocidad solo se aplica en "repetir", no en el turno nuevo (`conversation_screen.dart:323,424`) — mapear `native = 0.5 × uiRate` y aplicar antes de cada `speak` — S.
- **MAL-07 · Minimizar o pulsar atrás rompe la sesión** — no hay `WidgetsBindingObserver` en toda la app: el timer sigue, el TTS sigue sonando en segundo plano, el STT muere sin aviso; `dispose` no para el TTS; `ConversationScreen` no tiene `PopScope`, así que el back de Android abandona la sesión activa y al volver el temporizador reinicia en 10:00 — observar `paused`/`resumed` (pausar timer, `cancel()` STT, `stop()` TTS), `_tts.stop()` en `dispose`, `PopScope` que reutilice `_confirmEndByUser` — M.
- **MAL-08 · Un stream colgado bloquea la sesión** — `receiveTimeout: Duration.zero` (`core/api/http_fluent_api.dart:341`) sin timeout de inactividad ni `CancelToken`; un proxy medio abierto deja `_state = sending` y el micrófono deshabilitado para siempre; ningún request se cancela al salir de pantalla — `stream.timeout(30 s)` por evento con caída al modo completo; `CancelToken` por pantalla cancelado en `dispose` — M.
- **MAL-09 · Spinner infinito si falla la carga** — Nueva sesión, Progreso, Grupo, Memoria y Ajustes usan `FutureBuilder` que solo evalúa `!hasData` (`new_session_screen.dart:111`, `progress_screen.dart:35`, `group_screen.dart:84`, `memory_screen.dart:151`, `settings_screen.dart:95`); `_bootstrap` de conversación (`conversation_screen.dart:81-104`) tampoco captura errores — sin red, la app entera queda girando sin mensaje — un widget compartido `AsyncBody(loading, error, onRetry)` y `try/catch` en `_bootstrap` — S.
- **MAL-10 · Los recordatorios no funcionan en Android 13+** — nunca se llama `requestNotificationsPermission()` (`features/settings/data/reminder_service.dart`); los textos están fijos en español aunque la UI esté en pt-BR; nunca se cancelan el día con dos sesiones; "Alerta de racha" y "Efectos de sonido" son switches que no hacen nada (`settings_screen.dart:25-26,153-164`); las horas vuelven a 08:30/20:30 al reiniciar — pedir el permiso al activar, textos por ARB, persistir con `shared_preferences`, ocultar los switches hasta que existan — M.
- **MAL-11 · Callejón sin salida tras conectar el proveedor** — el onboarding hace `context.go('/providers')` (`onboarding_flow.dart:92`); `/providers` es ruta de nivel superior sin CTA "Continuar" ni flecha atrás; el back del sistema cierra la app (por verificar en teléfono) — añadir "Listo, ir a practicar" cuando haya proveedor activo, o hacer `push` desde Home — S.
- **MAL-12 · Zona horaria fija en Buenos Aires** — `onboarding_flow.dart:85` — para usuarios de Brasil o cualquier otro huso el corte de día de la racha y los recordatorios se calculan mal — `flutter_timezone` y editable en Ajustes — S.
- **MAL-13 · El bloqueo por proveedor es inconsistente** — Home deshabilita el CTA (`home_screen.dart:349-366`), pero la pestaña Practicar y los chips de temas rápidos siguen creando sesiones y fallan con un snackbar genérico — un único `canPractice` que redirija a `/providers` con el banner — S.
- **MAL-14 · Promesa rota en la invitación** — `registerInvitationPendingBody` dice "podés cargarlo más tarde desde el onboarding", pero ninguna pantalla vuelve a llamar `redeemInvitation`; quien continúa sin grupo no puede unirse nunca. Además los tokens se guardan antes de canjear el código (`register_screen.dart`) — añadir "Código de invitación" en Ajustes y corregir el copy — S.
- **MAL-15 · La fuente del diseño no está en la app** — `app/theme.dart:42` declara `PlusJakartaSans` pero `pubspec.yaml` no tiene sección `fonts:` ni existe `assets/`; todo renderiza en Roboto/SF — añadir los TTF (500/600/700/800) y declararlos — S.
- **MAL-16 · Identidad de la app = plantilla de Flutter** — icono byte a byte el del template (Android e iOS), `android:label="fluent_mobile"`, `CFBundleDisplayName "Fluent Mobile"`, release firmado con la clave debug (`android/app/build.gradle.kts:36-38`), sin `proguard-rules.pro` aunque `flutter_local_notifications` lo exige con R8 — icono propio con `flutter_launcher_icons`, label "Fluent", keystore de release, reglas keep — S.

### 4.2 API y seguridad

- **MAL-17 · [Medio] El bearer de cada usuario acaba en los logs** — `app.module.ts:33-40` y `worker.module.ts` configuran `pinoHttp` solo con `level`; el serializador `req` por defecto incluye `headers` completos y `autoLogging` va a `info` — los access tokens de todos los usuarios (y del owner, que abre Bull Board y Swagger) quedan en texto claro en Coolify durante su vida útil — `pinoHttp: { redact: ['req.headers.authorization','req.headers.cookie'], autoLogging: { ignore: r => r.url === '/v1/health' } }` — S.
- **MAL-18 · [Medio] Vinculación de cuenta por CSRF en el callback de OpenRouter, más redirección abierta** — `providers/providers.controller.ts:49-56` es `@Public()` y `providers.service.ts:157-189` canjea el `code` y guarda la key bajo el usuario que *inició* el flujo sin comprobar quién trae el navegador: un atacante inicia el flujo, manda el `authUrl` a una víctima y, si esta autoriza, su key queda bajo la cuenta del atacante. `isValidCallbackUrl` (`providers/pkce.ts:50-64`) acepta cualquier esquema salvo cuatro, así que `redirectTo` puede ser `https://evil…` servido con `meta refresh` desde `fluent.usebot.chat` — el callback público solo deja la key *pendiente* en Redis y la escritura final la hace `POST /pkce/complete` autenticado (ya existe); `callbackUrl` restringido a `fluent://` o allowlist. En el móvil, eliminar la rama legacy que acepta `code` por deep link sin `state` (`providers_screen.dart:71-88`) — M.
- **MAL-19 · [Medio] Bono de desafío auto-otorgable** — `sessions/dto/create-session.dto.ts:50-52` acepta `challengeFromUserId` y `sessions.service.ts:132` lo persiste sin validar que exista un desafío real; `close_session` paga +15 XP; los `userId` se ven en `GET /group` — cualquier miembro infla su XP y el ranking — validar en `openSession` contra `ChallengesService.listChallenges` o persistir los desafíos ofrecidos — M.
- **MAL-20 · Un brief que falla tres veces se pierde y la sesión queda `running`** — `jobs/coaching-brief/coaching-brief.service.ts:181` marca `running`; si BullMQ agota los intentos nadie escribe `failed` y no existe la reentrada desde la siguiente sesión que pide SPEC-05 §2.5 — memoria y brief dejan de actualizarse en silencio — `@OnWorkerEvent('failed')` → `brief_job_status='failed'` cuando `attemptsMade >= attempts`; en `openSession`, re-encolar la última sesión `failed` reciente — M.
- **MAL-21 · Un deploy corta turnos en vuelo** — `main.ts` no llama `enableShutdownHooks()` ni ajusta `keepAliveTimeout`; un SIGTERM entre el insert del turno del usuario y el del tutor deja un turno huérfano que contamina historial y brief — hooks de apagado, `server.keepAliveTimeout = 65_000` — S.
- **MAL-22 · El fallback de streaming re-emite tokens sin avisar** — si el intento 1 emite parte de `reply` y falla por `invalid_json`, el intento 2 vuelve a emitir desde cero (`llm/llm.service.ts:87-95`); la app no tiene evento `reset` — texto duplicado en pantalla — emitir `event: reset` antes del reintento o no emitir hasta que el parser confirme la forma — S.
- **MAL-23 · Los reintentos multiplican el gasto sin tope diario** — cada intento reenvía el prompt completo y hasta 350 tokens de salida; tres intentos = hasta 3× el coste del turno; sesiones por día ilimitadas — lo paga la cuenta gratuita del usuario, que se agota sin aviso — contador diario en Redis con aviso en la app y `maxAttempts` 2 en `turn` — S.

### 4.3 Producto y marketing

- **MAL-24 · La primera conversación está detrás de 11 pantallas y una salida a otra app** — registro (nombre, email, contraseña, código) → onboarding vuelve a pedir el nombre → nivel → 3 intereses → `/providers` obligatorio → crear key en aistudio.google.com o OAuth → Home → primer de micrófono (se repite en cada arranque) → tema → permiso → hablar 3 minutos. El CTA está deshabilitado sin proveedor; no hay modelo de cortesía — es el cuello de botella de activación — quitar el nombre del onboarding; persistir el primer; sesión de bienvenida con la credencial del owner del grupo usando solo la cadena gratuita (la infraestructura ya existe para el resumen semanal), limitada a 1 por usuario; mover `/providers` a después del primer resumen — M.
- **MAL-25 · No hay política de privacidad ni inventario de datos** — la app pide micrófono, guarda transcripciones y hechos personales extraídos por IA, cifra API keys de terceros y envía texto a OpenRouter/Google; no existe ningún documento — bloqueante para App Store y Play (Data Safety) — `docs/privacidad.md` publicado en una URL: qué se guarda (texto, no audio), quién lo ve, a dónde viaja, plazos de `retention.service.ts`, cómo borrar; anotar que `DELETE /me` no borra la cuenta de auth (limitación de InsForge) — S.
- **MAL-26 · Nombre "Fluent" sin verificar en tiendas** — PRD §12.5 lo deja abierto; es un término genérico de la categoría y Apple exige nombre único — rebrandear después de que el grupo lo llame así cuesta más — buscar en ambas tiendas antes de la fase 3; si está tomado, marca compuesta ("Fluent Crew", "Fluent con amigos") — S.
- **MAL-27 · Home dice "Día de gracia disponible" siempre que hay racha** — `home_screen.dart` `_StreakCard`; la API no expone `grace` (`progress/progress.mapper.ts`) — miente cuando la gracia ya se usó — exponer `grace: 'available' | 'used'` y copy para ambos — S.
- **MAL-28 · El resumen celebra igual una sesión inválida** — "¡Excelente sesión!" aunque `xpEarned == 0` — el usuario no entiende por qué no sumó XP ni racha — `summaryTooShortTitle` "Sesión corta" + "Con 3 minutos y 2 respuestas ya cuenta. ¿Otra ahora?" con CTA; variante de primera sesión válida que ancle la promesa de memoria — S.
- **MAL-29 · Tarjeta "Tu grupo esta semana" ordena por XP total** — `home_screen.dart` `_GroupCard` usa `GroupMember.xp` total mientras `/group` usa `xpWeek` — dos rankings distintos con el mismo título — usar el leaderboard en Home o exponer `xpWeek` en `/group` — S.

## 5. Lo que hay que mejorar

### 5.1 UI/UX móvil
- **MEJ-01 · Contraste por debajo de AA** — `textMuted #A3A9B2` sobre bg = 2.23:1; `textSecondary #6F7680` = 4.32:1 en `bodySmall` 12 px; gold sobre goldSoft = 1.61:1; accent sobre bg = 2.5:1 (chip de corrección, `conversation_screen.dart:611`); blanco sobre primary = 3.41:1; blanco sobre accent = 2.66:1 (botón Boss) — oscurecer `text-muted` (~#7A818A) y `text-secondary` (~#5C636C), `primary-dark` para texto sobre soft, validar botones con el diseñador — M.
- **MEJ-02 · Solo spinners, sin skeleton ni error accionable** — Home encadena `getMe` y 5 llamadas y muestra un `CircularProgressIndicator`; el único error es texto sin botón — `AsyncStateView` compartido con skeleton por pantalla y "Reintentar" (resuelve también MAL-09) — M.
- **MEJ-03 · Sin modo oscuro, text scaling ni reduced motion** — `app.dart:35` solo `theme:`; filas de 4 estadísticas sin `Expanded` desbordan con texto grande (`progress_screen.dart:44-55`); count-up y `animateTo` sin condicionar a `disableAnimations` — decidir dark mode con diseño; `Expanded`/`Wrap` en stats; respetar `MediaQuery.disableAnimations` — M.
- **MEJ-04 · Feedback de voz pobre** — "enviando" y "hablando" se ven idénticos (mic gris sin etiqueta); sin nivel de audio ni cuenta de los 45 s; no se puede interrumpir al tutor (`await _tts.speak`, `conversation_screen.dart:323`) — estados "Pensando…" / "Hablando…" con botón "Parar", indicador de nivel con `soundLevel` de `speech_to_text` — M.
- **MEJ-05 · Botón de micrófono y tarjetas sin semántica** — `_MicButton` es `InkWell` + `Container` (`conversation_screen.dart:767-780`) sin `Semantics`; igual el avatar y las tarjetas de nivel e intereses — `Semantics(button: true, label, toggled)` — S.
- **MEJ-06 · Formularios** — sin validación de email, sin mostrar/ocultar contraseña, sin `autofillHints` ni `textInputAction`, el nombre se pide dos veces (registro y onboarding paso 1), `DioException` no capturada en login/registro (el spinner desaparece sin mensaje), `InsforgeAuthClient._mapError` trata todo 400 como credenciales inválidas (se pierden "email ya existe" y "contraseña débil") — S.
- **MEJ-07 · Gamificación sin celebración** — el resumen solo anima el XP; racha estática, sin háptica, sin "Compartir tu racha" (pantalla 08 del Pen), sin señal de subida de nivel — `HapticFeedback.mediumImpact()`, animación de la llama, compartir racha como imagen (`RepaintBoundary` → PNG con marca) — M.
- **MEJ-08 · Acciones sin `catch` y sin deshacer** — confirmar/descartar/borrar hecho (`memory_screen.dart:49-62`), aceptar desafío (`group_screen.dart:53-69`), logout y borrar cuenta: un fallo no muestra nada; el swipe de borrar hecho no tiene deshacer — snackbar de error y "Deshacer" — S.
- **MEJ-09 · Estados vacíos ausentes** — Temas/Roleplay/Noticias, leaderboard vacío, resumen semanal que desaparece si falla — mensaje y acción por pestaña — S.
- **MEJ-10 · Mapeo de errores de API pobre** — 19 códigos en `ApiErrorCode` y la UI casi siempre muestra `errorGeneric`; `SESSION_ALREADY_ACTIVE` trae `activeSessionId` y nadie navega a él — `l10nForApiError(code)` y `go('/session/$id')` — S.
- **MEJ-11 · Textos fuera de ARB y copy** — `'${m.xp} XP'`, `'+$value'`, `'—'`, `providerId.toUpperCase()` ("OPENROUTER"), categorías de corrección crudas, 404 sin salida; pestaña "Home" sin traducir en es; "Coches y motor" (peninsular) y "Videojogos" (PT-PT) en un copy voseante y pt-BR; `reglas.md` y `i18n/es.json` mezclan voseo y tuteo — decidir registro (voseo en v1) y unificar — S.
- **MEJ-12 · Consistencia visual** — tres estilos de chip (`_InterestChip`, `ActionChip`, `Chip`); Home sin AppBar frente a Grupo/Progreso con AppBar; chips de 34 px y chip de corrección de ~20 px de alto (mínimo 44); timer sin cifras tabulares ni cambio de color bajo 2 min — `FluentChip` en `core/widgets`, `minimumSize`, `FontFeature.tabularFigures()` — S.
- **MEJ-13 · La pantalla de entrada no vende los dos diferenciadores** — `loginBenefit1..3` es copy de cualquier app de inglés con IA — "Un tutor que se acuerda de vos", "Practicá con tus amigos, no con extraños", "10 minutos, dos veces al día, con tu propia cuenta de IA gratis" — S.
- **MEJ-14 · Sin progreso visible en onboarding ni endowed progress** — no hay "paso 1 de 3"; la barra de nivel arranca en 0 — indicador de pasos; `xp_event` `profile_completed` de 20 XP; checklist en Home con el primer ítem ya tildado — S.

### 5.2 Rendimiento y robustez móvil
- **MEJ-15 · Secure storage leído en cada request** — `api_client.dart:33` hace `read()` (dos platform channels) por petición — cachear `AuthTokens` en memoria e invalidar en `write/clear` — S.
- **MEJ-16 · Home recarga todo en cada visita** — `/me` + 5 requests cada vez que se monta; con `ShellRoute` + `go` cada cambio de pestaña crea un `HomeScreen` nuevo; `getSessions(limit: 20)` solo sirve para contar las de hoy — `FutureProvider` con `keepAlive` e invalidación explícita; `sessionsToday` desde la API — M.
- **MEJ-17 · `setState` de pantalla completa por tick y por token** — `_onTick` y `onToken` rebuildan Scaffold, AppBar, ListView y controles cada segundo y cada delta — `ValueNotifier` para timer y burbuja viva, o `StateNotifier` con `select` — M.
- **MEJ-18 · Parser SSE une `data:` multilínea sin `\n`** (`http_fluent_api.dart:362`) — un JSON partido en dos líneas rompe el parseo → fallback → turno duplicado — unir con `\n` — S.
- **MEJ-19 · Refresh con retry ciego** — un 401 tardío vuelve a refrescar aunque otro request ya lo hizo; si `_doRefresh` lanza (`PlatformException` del keystore) la excepción sale del interceptor — comparar bearer fallido con el actual; `try/catch` en `_doRefresh` — S.
- **MEJ-20 · Detalles de navegación y datos** — ruta `summary` hace `state.extra as SessionSummary` y revienta sin extra (`router.dart:112`); posición en el grupo comparada por `displayName` (`home_data.dart`); doble toque en Home crea dos sesiones (`home_screen.dart:574`, sin el guard que sí tiene `new_session_screen.dart:73`); `TextEditingController` sin dispose en la hoja de Gemini y en editar hecho — S.
- **MEJ-21 · Release** — `SCHEDULE_EXACT_ALARM` declarado pero se usa `inexactAllowWhileIdle` (quitarlo); iOS permite landscape; sin `allowBackup="false"`; esquema `fluent://` secuestrable (migrar a App Links / Universal Links cuando haya dominio) — S.
- **MEJ-22 · Spec desalineada** — SPEC-06 §1 dice Riverpod 3 con `riverpod_annotation`; el código usa `flutter_riverpod` 2 sin codegen y pantallas con `FutureBuilder` + `setState` — alinear la spec (S) o migrar (L).
- **MEJ-23 · Cobertura móvil** — sin tests de `ApiClient` (401→refresh→retry, concurrencia, refresh fallido), `bootstrap` offline, `RouterNotifier`, STT ante error, callback OAuth con `error=`, chunks SSE partidos — M.

### 5.3 Rendimiento y arquitectura API
- **MEJ-24 · Round-trips secuenciales antes del LLM** — `sessions/turns.service.ts:110-285`: sesión → perfil → credenciales → historial → insert → brief‖hechos → preferencia, casi todo en serie: 8-9 RTT a InsForge (us-east) antes del primer token — `Promise.all` tras validar la sesión, o RPC `prepare_turn` — S/M.
- **MEJ-25 · Escritura post-LLM en 4 llamadas** — turno del tutor, correcciones, update de sesión, `llm_calls` con `await` en la ruta caliente (`llm/llm.service.ts:174,213`) — RPC `record_turn` atómica y sink en `void … .catch()` — M.
- **MEJ-26 · Sweeper N+1 y retención sin límite** — `session-sweeper.service.ts:371` consulta `turns` por cada sesión activa cada minuto; `maintenance.repository.ts:386-402` carga todas las sesiones de más de 365 días y hace `.in(ids)` por query-string, que acabará superando el límite de URL — RPC `sweep_sessions()` y `purge_old_turns(cutoff)` — M.
- **MEJ-27 · Timeouts y salud** — `insforge/insforge.http.ts` hace `fetch` sin `AbortSignal.timeout`; el healthcheck de Docker con `--timeout=3s` y `ok = redis && insforge` reinicia la API aunque el código degrade bien sin Redis; el healthcheck del worker es `pgrep` (tautológico); `/health` sin auth ni throttle abre un `fetch` a InsForge por hit y publica la versión — timeouts de 2-5 s, separar liveness/readiness, cachear health 5-10 s, heartbeat real del worker — S.
- **MEJ-28 · Dockerfile no reproducible y heap sin tope** — `--no-frozen-lockfile` con contexto `apps/api` (sin lockfile ni overrides de la raíz: `multer` queda en 2.2.0 en la imagen), `chown -R` tras `COPY`, sin `--max-old-space-size` acorde a los límites de Coolify — construir desde la raíz con `--filter @fluent/api` y `--frozen-lockfile`, mover overrides a `apps/api/package.json`, `COPY --chown`, `NODE_OPTIONS` — M.
- **MEJ-29 · `usage` en streaming puede quedar en 0** — no se manda `stream_options: { include_usage: true }` (`llm/llm.client.ts:211`, PEND-53); `tokens_*` en 0 sesgan el coste estimado — enviar `stream_options` (inocuo en API compatible) y registrar `null` cuando no llegue — S.
- **MEJ-30 · `trust proxy` sin configurar** — el throttler cae a `request.ip` en rutas públicas; detrás de Traefik/Cloudflare es la IP del proxy: 60 callbacks OAuth por minuto para todos los usuarios juntos — `app.set('trust proxy', 1)` o tracker por `CF-Connecting-IP` — S.
- **MEJ-31 · Validaciones y menores** — `FALLBACK_MODELS` inválido cae en silencio al default (validar en zod); `countCorrections` trae hasta 500 ids en vez de `count: 'exact'`; `weekly-summary` hace 2 consultas por miembro cuando `listMembers` ya trae `streak`; TTL del catálogo 6 h = periodo del cron (spec dice 7 h); índices `xp_events(created_at)` y `sessions(ended_at)` si el grupo crece; `supertest/types` rompe `tsc` en los e2e — S.
- **MEJ-32 · Cobertura API** — sin test unitario de `insforge.http.ts` (la forma `data.id ?? data.user.id` es una suposición), `provider-api.client.ts`, `pkce.store.ts`, `job-dispatcher.ts`, los tres processors, `truncate.ts`; sin test de SIGTERM — M.

### 5.4 Seguridad (endurecimiento)
- **MEJ-33 · Registro abierto y política laxa** — `insforge.toml`: `disable_signup=false`, sin verificación de email, contraseña de 6 caracteres; la invitación solo gatea el grupo, no el uso — activar verificación, mínimo 10-12, valorar exigir grupo en `POST /sessions` — S/M.
- **MEJ-34 · Cabeceras** — sin `helmet` ni `x-powered-by` desactivado; HSTS depende de Cloudflare — S.
- **MEJ-35 · Prompt injection de baja severidad** — brief (editable por el usuario) y hechos entran en el system prompt sin delimitadores (`llm/prompts/turn.ts:118-124`); `display_name` de cada miembro entra en el prompt semanal del grupo (`weekly.ts:11,30`): un miembro puede alterar el resumen de todos — bloques delimitados y aviso al modelo de que son datos — S.
- **MEJ-36 · Feeds por `http://`** — `content/feeds.json:4,10` (BBC) sin límite de tamaño — `https://` y `maxBytes` — S.
- **MEJ-37 · Rotación de clave incompleta** — SPEC-02 §5 pide recifrar en un job; no existe — M.

### 5.5 Retención, loops sociales y crecimiento
- **MEJ-38 · Recordatorios sin opt-in en el momento correcto** — nadie los activa por defecto; el mejor momento es justo después del primer resumen de sesión: "¿Te aviso mañana a esta misma hora? 3 minutos alcanzan para mantener la racha." — M (con MAL-10).
- **MEJ-39 · Racha en peligro no existe** — al cerrar cada sesión válida, programar notificación local para mañana 20:30 "Tu racha de {n} días vence a medianoche" y cancelarla al cerrar sesión; si hay gracia, "Hoy te salva el día de gracia; mañana no." — M.
- **MEJ-40 · El progreso real de inglés no se comunica** — solo "n correcciones en 7/30 días"; `level_hint` y `recurring_errors` del brief no llegan a UI — "Tu error más frecuente: past simple (8 → 3 esta semana)", "El coach te ve en B1+", "Este mes hablaste 42 minutos en inglés" — M.
- **MEJ-41 · Loops sociales incompletos** — solo el owner invita por endpoint admin (`groups/groups.service.ts:51`), sin pantalla; el resumen semanal se comparte como texto plano sin pie ni marca; el botón dice "Compartir en WhatsApp" pero abre el share sheet genérico — invitación desde la app para cualquier miembro con mensaje prellenado, footer fijo añadido por la API ("— Fluent · practicá inglés con tus amigos" y link cuando exista dominio), renombrar el botón — M.
- **MEJ-42 · Sin proyección a más grupos** — un grupo por usuario, owner único — "Crear grupo" que convierte al creador en owner; el resumen semanal ya se paga con la credencial del owner, así que escala a coste cero — L.
- **MEJ-43 · Falta `.agents/product-marketing.md`** — no existe; el borrador está en el anexo C — S.
- **MEJ-44 · Métricas de activación no derivables hoy** — falta `invalid_reason` en sesiones, filtro de sesiones válidas en admin, eventos de cliente (`reminder_scheduled`, `weekly_summary_shared`, `boss_declined`, `callback_shown`) — anexo D — M.

## 6. Checklist

Orden de ataque propuesto. P0 = antes de la próxima build que reciba el grupo; P1 = las dos semanas siguientes; P2 = cuando se abra a más gente o a tiendas.

### P0 · Bloqueantes y seguridad (una tarde cada uno o menos)
- [ ] MAL-01 Añadir `NSMicrophoneUsageDescription` y `NSSpeechRecognitionUsageDescription` en `Info.plist`
- [ ] MAL-17 `redact` de `authorization`/`cookie` en `pinoHttp` (api y worker) e ignorar `/v1/health` en autoLogging
- [ ] MAL-18 Callback público de OpenRouter solo deja la key pendiente; `pkce/complete` autenticado la escribe; `callbackUrl` restringido; quitar rama `code` del móvil
- [ ] MAL-19 Validar `challengeFromUserId` contra los desafíos reales antes de persistirlo
- [ ] MAL-21 `enableShutdownHooks()` y `keepAliveTimeout` 65 s en `main.ts`
- [ ] MAL-02 `onSessionExpired` de `ApiClient` → `AuthController` a `unauthenticated`; logout remoto en logout y borrar cuenta
- [ ] MAL-03 Solo borrar tokens en 401; sin red mostrar reintento
- [ ] MAL-04 Limpiar `activeSessionId` al cerrar sesión antes de navegar
- [ ] MAL-09 `AsyncBody` compartido con error y "Reintentar" en las 5 pantallas + `try/catch` en `_bootstrap`
- [ ] MAL-06 Mapear velocidad TTS (`0.5 × rate`) y aplicarla antes de cada `speak`
- [ ] MAL-11 CTA "Ir a practicar" en `/providers` cuando hay proveedor activo
- [ ] MAL-13 Un solo `canPractice` para CTA, pestaña Practicar y chips
- [ ] MAL-15 Empaquetar Plus Jakarta Sans (4 pesos) en `pubspec.yaml`
- [ ] MAL-16 Icono propio, label "Fluent", keystore de release, `proguard-rules.pro`
- [ ] MAL-12 Timezone real del dispositivo con `flutter_timezone`

### P1 · Robustez, activación y retención
- [ ] MAL-05 `onStatus`/`onError` en STT; distinguir permiso denegado de locale ausente
- [ ] MAL-07 `WidgetsBindingObserver` (pausar timer/STT/TTS), `_tts.stop()` en dispose, `PopScope` en conversación
- [ ] MAL-08 Timeout de inactividad en SSE + `CancelToken` por pantalla
- [ ] MAL-10 Permiso `POST_NOTIFICATIONS`, textos por ARB, persistir horas, cancelar tras la 2ª sesión, ocultar switches decorativos
- [ ] MAL-14 "Código de invitación" en Ajustes y corregir el copy del registro
- [ ] MAL-20 Marcar brief `failed` al agotar intentos y re-encolar desde la siguiente sesión
- [ ] MAL-22 Evento `reset` en el fallback de streaming (API) y manejo en la app
- [ ] MAL-23 Tope diario de turnos con aviso; `maxAttempts` 2 en `turn`
- [ ] MAL-24 Quitar nombre del onboarding, persistir primer de micrófono, sesión de bienvenida con credencial del owner, `/providers` después del primer resumen
- [ ] MAL-27 Exponer `grace` en `/progress` y copy para usado/disponible
- [ ] MAL-28 Copy de sesión corta y de primera sesión válida en el resumen
- [ ] MAL-29 Tarjeta de grupo en Home con XP semanal
- [ ] MEJ-01 Corregir tokens de contraste con el diseñador (muted, secondary, gold, accent, botones)
- [ ] MEJ-02 Skeletons por pantalla
- [ ] MEJ-04 Estados "Pensando/Hablando", botón Parar, nivel de audio
- [ ] MEJ-05 `Semantics` en mic, avatar, tarjetas
- [ ] MEJ-06 Validación de email, toggle de contraseña, autofill, `catch` en login/registro, `_mapError` por código
- [ ] MEJ-07 Háptica, animación de racha y "Compartir tu racha" como imagen
- [ ] MEJ-08 `catch` + snackbar + deshacer en memoria, desafíos, logout
- [ ] MEJ-10 `l10nForApiError` y salto a la sesión activa
- [ ] MEJ-11 Unificar registro (voseo) en ARB, `reglas.md` e `i18n/es.json`; sacar literales a ARB; corregir "Home", "Coches y motor", "Videojogos"
- [ ] MEJ-13 Tres beneficios de la pantalla de entrada con memoria y amigos
- [ ] MEJ-14 "Paso n de 3" y 20 XP por perfil completado
- [ ] MEJ-15 Tokens en memoria en `ApiClient`
- [ ] MEJ-16 `HomeData` en provider con `keepAlive` e invalidación; `sessionsToday` en la API
- [ ] MEJ-17 Timer y burbuja viva en `ValueNotifier`
- [ ] MEJ-18 Unir `data:` multilínea con `\n`
- [ ] MEJ-19 Refresh: comparar bearer y `try/catch` en `_doRefresh`
- [ ] MEJ-20 `extra` opcional en summary, comparar por `userId`, guard de doble toque, dispose de controllers
- [ ] MEJ-24 Paralelizar el contexto del turno con `Promise.all`
- [ ] MEJ-25 RPC `record_turn` y sink sin `await`
- [ ] MEJ-27 Timeouts en `insforge.http.ts`, liveness/readiness separados, health cacheado, heartbeat del worker
- [ ] MEJ-29 `stream_options.include_usage` y `null` en vez de 0
- [ ] MEJ-30 `trust proxy` o tracker por `CF-Connecting-IP`
- [ ] MEJ-33 Verificación de email y contraseña mínima 10-12 en `insforge.toml`
- [ ] MEJ-35 Delimitar brief, hechos y `display_name` en los prompts
- [ ] MEJ-36 Feeds por `https://` con `maxBytes`
- [ ] MEJ-38 Opt-in de recordatorios tras el primer resumen
- [ ] MEJ-39 Notificación local de racha en peligro
- [ ] MEJ-41 Invitar desde la app, footer con marca en el resumen semanal, renombrar "Compartir"
- [ ] MEJ-43 Crear `.agents/product-marketing.md` (anexo C)
- [ ] MEJ-22 Alinear SPEC-06 con Riverpod 2 sin codegen

### P2 · Escala, tiendas y pulido
- [ ] MAL-25 `docs/privacidad.md` publicado en una URL
- [ ] MAL-26 Verificar "Fluent" en App Store y Play; metadatos del anexo E
- [ ] MEJ-03 Dark mode, text scaling, reduced motion
- [ ] MEJ-09 Estados vacíos por pestaña
- [ ] MEJ-12 `FluentChip`, AppBar consistente, targets 44 px, timer tabular
- [ ] MEJ-21 Quitar `SCHEDULE_EXACT_ALARM`, bloquear landscape, `allowBackup="false"`, App Links
- [ ] MEJ-23 Tests móviles de `ApiClient`, bootstrap offline, STT, OAuth error, SSE partido
- [ ] MEJ-26 RPC `sweep_sessions` y `purge_old_turns`
- [ ] MEJ-28 Dockerfile desde la raíz con `--frozen-lockfile`, overrides en `apps/api`, `--max-old-space-size`
- [ ] MEJ-31 Validar `FALLBACK_MODELS`, `count: 'exact'`, TTL 7 h, índices semanales, arreglar `supertest/types`
- [ ] MEJ-32 Tests de `insforge.http.ts`, processors, `pkce.store`, SIGTERM
- [ ] MEJ-34 `helmet` y `x-powered-by`
- [ ] MEJ-37 Job de recifrado al rotar `CREDENTIALS_MASTER_KEY`
- [ ] MEJ-40 Progreso real de inglés en Progreso (error más frecuente, `level_hint`, minutos hablados)
- [ ] MEJ-42 "Crear grupo" para cualquier usuario
- [ ] MEJ-44 Eventos de activación y retención (anexo D)

## Anexo A · Pasos hasta la primera conversación (usuario nuevo, hoy)

| # | Pantalla | Obligatorio | ¿Se puede posponer? |
|---|---|---|---|
| 1 | Splash | — | — |
| 2 | Bienvenida | "Crear cuenta" | — |
| 3 | Registro | nombre, email, contraseña, código | código sí |
| 4 | Onboarding 1 | nombre otra vez | no |
| 5 | Onboarding 2 | nivel | no |
| 6 | Onboarding 3 | ≥3 intereses | no |
| 7 | Proveedores (forzado) | key de Gemini (salir a aistudio.google.com) u OAuth de OpenRouter | no: Home deshabilita el CTA |
| 7b | Proveedores | sin CTA para volver (MAL-11) | — |
| 8 | Home | "Practicar 10 min" | — |
| 9 | Primer de micrófono | Continuar (se repite en cada arranque) | — |
| 10 | Nueva sesión | tema o Sorprendeme | — |
| 11 | Conversación | permiso del SO, tocar mic, hablar | — |

Total: 11 pantallas, 8 entradas obligatorias, una salida a otra app. Objetivo tras MAL-24: 7 pantallas, 5 entradas, cero salidas antes del aha.

## Anexo B · Round-trips y tokens por turno (ruta feliz, sin fallback)

| Fase | InsForge | Redis |
|---|---|---|
| Auth | 0 (1 cada 5 min por token) | 1 |
| Validar, lock, ritmo | 1 | 2 |
| Contexto (perfil, credenciales, historial, brief‖hechos, preferencia) | 5-6 en serie | — |
| Insert turno usuario | 1 | — |
| LLM | 1 externa (≤25 s) | — |
| Registro y persistencia | 3-4 | 2 |
| **Total** | **11-13 secuenciales** | **5** |

Con RTT ≈ 100 ms a us-east son 1-1,5 s antes del primer token (no medido). Tokens de entrada estimados: 1 000-2 200 por turno; salida 80-250 (tope 350). Brief: ~1 800 tokens una vez por sesión.

## Anexo C · Borrador de `.agents/product-marketing.md`

```markdown
# Fluent — contexto de producto y marketing
**One-liner:** Practicá inglés hablado 10 minutos al día con un tutor de IA que se acuerda de vos, compitiendo con tus amigos.
**Qué es:** app móvil (Flutter) de conversación por voz en inglés. Tutor con memoria entre sesiones, correcciones en la misma respuesta, XP, rachas, ranking semanal y resumen para WhatsApp.
**Etapa:** v1 privada, grupo cerrado de 5–10 amigos, solo por invitación, sin monetización. Nombre de trabajo "Fluent" (sin verificar en tiendas).
**Público:** adultos hispanohablantes y brasileños, nivel A2–B2, con 10 minutos y no una hora. Registro: voseo en es (decisión v1), pt-BR informal. Si se abre al público, pasar es a tuteo neutro.
**Modelo:** BYOK. Cada usuario conecta su cuenta gratuita de OpenRouter o Gemini; el operador no paga LLM. Ventaja: "gratis de verdad, sin suscripción"; desventaja: fricción de conectar.
**Diferenciadores (en este orden):** 1) memoria del tutor con control total del usuario; 2) social entre amigos, no contra extraños; 3) 10 minutos, dos veces al día; 4) sin coste ni suscripción.
**Aha moment:** primera sesión válida (≥3 min, ≥2 turnos) con al menos una corrección y XP. Aha secundario: primera apertura con callback ("¿cómo te fue en…?").
**Métrica norte:** sesiones válidas por usuario por semana (objetivo PRD: ≥8). Retención: activos semanales ≥70 % del grupo.
**Voz y tono:** cercano, directo, sin épica. Frases cortas. Humor suave en el resumen semanal. Nunca infantil.
**Palabras a usar:** hablar, conversación, se acuerda de vos, tus amigos, racha, 10 minutos, tu cuenta, corrección.
**Palabras a evitar:** fluidez garantizada, nativo en X semanas, gamificación, IA revolucionaria, aprende (usar "practicá"), premium/plus, lecciones, curso.
**Competencia mental del usuario:** Duolingo (juego, no habla), ELSA/Speak (habla, no recuerda, paga), ChatGPT por voz (recuerda a medias, sin juego ni amigos).
**Canales v1:** WhatsApp del grupo (resumen semanal, invitaciones). No hay web, dominio ni tiendas todavía.
**Privacidad como promesa:** solo texto, nunca audio; hechos editables; amigos ven XP/racha/temas, nunca conversaciones.
```

## Anexo D · Eventos a medir

| Evento | Definición | Dónde vive hoy | Falta |
|---|---|---|---|
| `invitation_redeemed` | código canjeado | `invitations.used` | — |
| `onboarding_completed` | perfil guardado | `profiles.onboarded_at` | paso en que abandona (cliente) |
| `provider_connected` | primera credencial activa | `provider_credentials.connected_at` | tiempo desde registro |
| `activated` | primera sesión con `xp_earned > 0` | derivable | consulta de activación y time-to-activation |
| `session_invalid` | cerrada con XP 0 y motivo | `sessions` (sin motivo) | columna `invalid_reason` |
| Sesiones válidas/usuario/día | métrica norte | `sessions.xp_earned` | filtro válido en admin |
| D1 / D7 / W4 | vuelve al día / semana siguiente | derivable de `sessions.started_at` | consulta de cohortes |
| `streak_saved` / `streak_lost` | gracia aplicada / racha a 1 | `daily-streaks.service.ts` | fila en `xp_events` |
| `reminder_scheduled` / `notification_opened` | local | nada | `POST /events` desde la app |
| `weekly_summary_shared` | toque en compartir | nada | evento cliente |
| `challenge_accepted` | sesión desde desafío | `sessions.challenge_from_user_id` | — |
| `boss_offered` / `boss_declined` | oferta y "Hoy no" | solo aceptadas | evento cliente |
| `callback_shown` | apertura con hecho | nada | flag en `sessions` |
| `facts_confirmed` / `dismissed` | ratio de alucinación percibida | `facts.status` | — |
| Tasa de fallo LLM, latencia p90 | RNF | `llm_calls` | — |

## Anexo E · Metadatos de tienda propuestos (cuando toque)

- Título (30): "Fluent: Inglés por voz con IA" / "Fluent: Inglês por voz com IA"
- Subtítulo (30): "Inglés hablado con tus amigos" / "Inglês falado com seus amigos"
- Keywords: `inglés,conversación,hablar,pronunciación,tutor,ia,racha,amigos,speaking,roleplay`
- Categoría: Educación
- Screenshots (6): tutor que recuerda · corrección en la burbuja · ranking del grupo · resumen de WhatsApp · "Lo que recuerdo de vos" · racha y boss battle
