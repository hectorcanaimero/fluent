# PR-06 — App móvil · rama `feat/mobile` · SPEC-06

Sesión líder: Sonnet 5. Empieza ya: todas las pantallas se construyen contra un `FakeApi` que implementa los contratos de SPEC-02 con datos de ejemplo, y se conectan a la API real al final. Cada pantalla sigue el diseño de Pen en `docs/design/` (ver README de tareas).

Nota para el VPS: `flutter analyze` y `flutter test` corren aquí; `flutter run` solo en la Mac del operador.

## T1 · Esqueleto: tema, rutas, estado y HTTP
- Modelo: Sonnet 5 · Depende de: nada · Bloquea a: todo
- Alcance: dependencias de SPEC-06 §1 en `pubspec.yaml`; `app/router.dart` con las rutas y redirecciones de §3; tema derivado de los tokens del diseño de Pen (colores, tipografías, radios) en `app/theme.dart`; `core/http/api_client.dart` (dio con interceptor de refresh); `core/storage/token_store.dart`; `--dart-define` para `API_URL` e `INSFORGE_URL`; `FakeApi` con toggle por define `USE_FAKE_API`.
- Aceptación: `flutter analyze` sin avisos; test de widget: sin token → `/login`.
- Commit: `feat(mobile): esqueleto con rutas, tema, cliente HTTP y API simulada`

## T2 · Auth contra InsForge y registro con invitación
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: T3
- Alcance: `InsforgeAuthClient` REST según SPEC-06 §6; pantallas `/login` y `/register` (email, contraseña, código de invitación); flujo registro → canje → onboarding; errores en español; refresh con lock.
- Aceptación: tests de widget con servidor simulado (`http_mock_adapter`): login ok, contraseña incorrecta, código inválido mantiene la cuenta y vuelve a pedir código.
- Commit: `feat(mobile): login, registro e invitación`

## T3 · Onboarding
- Modelo: Sonnet 5 · Depende de: T2 · Bloquea a: T4
- Alcance: 4 pasos de SPEC-06 §3 con `PUT /me/profile` al final del paso 3 y salto a la pantalla de proveedores en el paso 4; catálogo de intereses desde la API (`GET /me` incluye `interestsCatalog`; coordinar con PR-02/T2: campo a añadir en el DTO) o, hasta entonces, copia local de `interests.json`.
- Aceptación: test de widget: no deja avanzar con menos de 3 intereses; al terminar navega a `/`.
- Commit: `feat(mobile): onboarding de perfil`

## T4 · Proveedores y modelos
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: T6
- Alcance: pantalla de SPEC-06 §4.6: PKCE con `flutter_web_auth_2` y deep link `fluent://oauth/openrouter` (configurar `AndroidManifest.xml` e `Info.plist`), pegado de key de Gemini con ayuda, estado y crédito, selector de modelo por rol con tiers y costo estimado.
- Aceptación: test de widget con `FakeApi`: flujo Gemini completo; modelo de proveedor no conectado aparece deshabilitado; test manual del deep link en dispositivo documentado en el PR.
- Commit: `feat(mobile): conexión de proveedores y selección de modelos`

## T5 · Home y nueva sesión
- Modelo: Sonnet 5 · Depende de: T1 · Bloquea a: T6
- Alcance: Home de §4.1 (streak, gracia, botón principal, boss, tarjeta de grupo, tarjeta de hechos pendientes, banner sin proveedor) y selector de §4.2 con tres pestañas.
- Aceptación: tests de widget para cada estado de Home con `FakeApi`.
- Commit: `feat(mobile): home y selección de sesión`

## T6 · Conversación por voz
- Modelo: Opus 5 · Depende de: T4, T5 · Bloquea a: T7
- Alcance: pantalla de §4.3 con máquina de estados `idle/listening/reviewing/sending/speaking`, `speech_to_text` y `flutter_tts` según §5, ducking, transcripción editable, chips de corrección, temporizador con aviso a 8:00 y cierre a 10:00, manejo de `degraded` y `unavailable`, modo texto, permiso de micrófono con pantalla previa.
- Aceptación: tests de widget con voz simulada (interfaces `SpeechService` y `TtsService` con fakes): flujo completo escuchar → editar → enviar → mostrar corrección → reproducir; tres `unavailable` → diálogo; temporizador dispara `/end`. Prueba manual en dispositivo con acento hispano documentada.
- Commit: `feat(mobile): pantalla de conversación por voz`

## T7 · Resumen de sesión y memoria
- Modelo: Sonnet 5 · Depende de: T6 · Bloquea a: nada
- Alcance: pantalla de resumen de §4.4 y pantalla de memoria de §4.5 (confirmar, descartar, editar, borrar, olvidar todo con doble confirmación).
- Aceptación: tests de widget: confirmar hecho lo mueve de sección; olvidar todo requiere dos confirmaciones.
- Commit: `feat(mobile): resumen de sesión y memoria editable`

## T8 · Grupo, progreso y ajustes
- Modelo: Sonnet 5 · Depende de: T5 · Bloquea a: nada
- Alcance: pantallas de §4.7 (leaderboard, desafíos que abren sesión, resumen semanal con compartir), progreso (XP, nivel, tendencia de correcciones) y ajustes (perfil, zona horaria, recordatorios locales de §8, borrar cuenta).
- Aceptación: tests de widget con `FakeApi`; compartir invoca `share_plus` con el texto del resumen.
- Commit: `feat(mobile): grupo, progreso y ajustes`

## T9 · Conexión con la API real y pulido
- Modelo: Sonnet 5 · Depende de: T2 a T8, PR-04 fusionado y desplegado · Bloquea a: fase 1 completa
- Alcance: quitar `USE_FAKE_API` del build de release, `--dart-define` documentados en `apps/mobile/README.md`, revisión de todos los textos en español, estados vacíos y de error, `flutter build apk --release` en la Mac y prueba de punta a punta con dos usuarios reales.
- Aceptación: sesión real de 10 minutos con corrección mostrada y brief generado al cerrar; checklist en el PR.
- Commit: `feat(mobile): conexión a la API real y pulido de fase 1`
