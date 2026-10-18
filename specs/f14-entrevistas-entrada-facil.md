---
type: spec
project_id: fluent
phase: 14
version: 0.1
depends_on:
  - docs/arch/003-simulador-entrevistas.md
  - specs/f11-entrevistas-app-entrada.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-18
title: Simulador de entrevistas — entrada sin copiar la vacante
---

# F14 — Entrada sin copiar la vacante

Copiar o escribir la vacante es el paso que más frena a quien quiere practicar.
Dos atajos: compartir la vacante desde la app de empleos (LinkedIn, Indeed,
Gupy…) hacia Open Fluent, en Android y en iOS, y entrevistas listas para
arrancar con un toque cuando todavía no hay una vacante concreta.

Base: la pantalla de entrada `/interviews/new`
(`apps/mobile/lib/features/interviews/presentation/entry/new_interview_screen.dart`,
F11.2.T1) y el PR #111, que ya permite mandar una descripción corta en
cualquier idioma como `offerText` y enseña al Diseñador del agente a armar el
plan con ella. No hay cambios de API: todo viaja por `POST /v1/interviews`
como hoy (`offerText` u `offerUrl`, mismo tope diario).

Reglas para todas las tareas:

- Nada lee páginas de LinkedIn ni de otros portales: se usa solo el texto que
  la persona comparte (al compartir una vacante, LinkedIn manda título,
  empresa y enlace en el texto). Sin scraping ni login de terceros.
- Compartir **no** prepara la entrevista solo: rellena el campo y la persona
  toca "Preparar entrevista" (consumir el tope diario es una decisión suya).
- Textos en español neutro latinoamericano con tuteo, nunca voseo, y pt-BR,
  en `app_es.arb` y `app_pt.arb`; regenerar `lib/l10n/gen/` con
  `flutter gen-l10n`.

## F14.1 — Package: entrevistas listas

### F14.1.T1 — Entrevistas listas para empezar con un toque

En la pantalla de entrada, debajo del campo de la oferta y solo mientras está
vacío, una sección "O empieza con una entrevista lista" con 6 tarjetas:
Desarrollo backend, Desarrollo frontend / móvil, Datos y analítica, Producto
(Product Manager), Diseño UX/UI y Atención al cliente / ventas en inglés.
Cada tarjeta muestra el título y una línea de qué se practica.

- Las tarjetas viven en un archivo nuevo `starter_templates.dart` (lista
  constante: id, clave de título, clave de descripción, clave de `offerText`).
  El `offerText` es una descripción corta localizada que el Diseñador entiende
  (p. ej. "Entrevista para desarrollador backend semi senior en una empresa de
  tecnología de producto"); nivel semi senior por defecto.
- Tocar una tarjeta rellena el campo con ese `offerText` (la persona puede
  ajustarlo, p. ej. cambiar el nivel) y lleva el foco al botón "Preparar
  entrevista"; no crea la entrevista por sí sola.
- Con el tope diario agotado las tarjetas se ven deshabilitadas, igual que el
  campo.
- Sin cambios de API ni del agente.

Done when: widget tests en `test/features/interviews/entry/` cubren que las
tarjetas aparecen con el campo vacío y desaparecen al escribir, que tocar una
rellena el campo con su `offerText` sin llamar a `create` en `FakeFluentApi`,
que "Preparar entrevista" después manda ese texto como `offerText`, y que con
el tope agotado no responden. `flutter test` y `flutter analyze` sin errores.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: UI acotada sobre una pantalla existente, sin backend.
- **Dependencies**:
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/entry/starter_templates.dart`
  - `apps/mobile/lib/features/interviews/presentation/entry/new_interview_screen.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/lib/l10n/gen/`
  - `apps/mobile/test/features/interviews/entry/`

## F14.2 — Package: compartir la vacante hacia la app

### F14.2.T1 — Recibir una vacante compartida (Dart + Android)

Open Fluent aparece en el menú "Compartir" de Android para texto y enlaces, y
lo compartido abre la entrada de entrevistas con el campo ya rellenado.

- Paquete: `receive_sharing_intent` (o `share_handler` si el primero no
  soporta Swift Package Manager, que es lo que usa el proyecto en iOS; no hay
  Podfile). Elegir uno que sirva para Android **y** iOS, porque F14.2.T2 lo
  reutiliza, y anotar la razón en el PR.
- Android: `intent-filter` `android.intent.action.SEND` con `text/plain` en
  la `MainActivity` (`launchMode` `singleTask` si hace falta para no abrir
  una segunda instancia).
- Dart: un servicio `incoming_share.dart` que escucha lo compartido en
  arranque en frío y con la app abierta, y navega a `/interviews/new` pasando
  el texto. `NewInterviewScreen` acepta un texto inicial que tiene prioridad
  sobre el borrador guardado (y lo reemplaza como borrador).
- Texto compartido: se usa entero (título + empresa + enlace) como
  `offerText`; `looksLikeOfferUrl` ya lo trata como texto por tener espacios.
  Si solo llega un enlace, va como hoy (`offerUrl`, con el panel de enlace no
  legible si no se puede leer).
- Sin sesión iniciada: se guarda lo compartido y se abre la entrada después
  del login/onboarding, sin perderlo.

Done when: tests unitarios del servicio (texto con enlace, solo enlace, texto
vacío ignorado, arranque en frío vs. app abierta con el plugin simulado), un
widget test de que el texto inicial pisa el borrador, `flutter test` y
`flutter analyze` sin errores, y `flutter build apk --debug` compila. En el PR,
pasos para probarlo a mano compartiendo una vacante desde LinkedIn en Android.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: Integración nativa con arranque en frío/caliente y rutas; acotada a una plataforma.
- **Dependencies**: F14.1.T1
- **Files**:
  - `apps/mobile/pubspec.yaml`
  - `apps/mobile/pubspec.lock`
  - `apps/mobile/android/app/src/main/AndroidManifest.xml`
  - `apps/mobile/lib/features/interviews/presentation/entry/incoming_share.dart`
  - `apps/mobile/lib/features/interviews/presentation/entry/new_interview_screen.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/main.dart`
  - `apps/mobile/test/features/interviews/entry/`

### F14.2.T2 — Share extension de iOS y firma en Codemagic

Open Fluent aparece en la hoja de compartir de iOS para texto y enlaces, y lo
compartido llega al mismo servicio Dart de F14.2.T1.

- Nuevo target "Share Extension" en `ios/Runner.xcodeproj`
  (`com.guria.openfluent.ShareExtension`), con la plantilla del paquete
  elegido en F14.2.T1; `NSExtensionActivationRule` limitado a texto y una
  URL. App Group `group.com.guria.openfluent` en los entitlements de Runner y
  de la extensión. El proyecto usa Swift Package Manager: no introducir
  CocoaPods.
- `codemagic.yaml` (workflow iOS): firmar también la extensión — borrar y
  regenerar los perfiles de los dos identificadores y llamar a
  `fetch-signing-files` para ambos, de modo que `xcode-project use-profiles`
  asigne cada perfil a su target.
- `docs/runbooks/despliegue.md`: pasos manuales que la CLI no puede hacer
  (crear el App Group en Apple Developer, crear el identificador de la
  extensión y asignarles el App Group a ambos identificadores) y cómo
  verificarlo.

Done when: `flutter build ios --release --no-codesign` compila con el nuevo
target, `flutter test` sigue verde, el YAML de Codemagic es válido y el
runbook lista los pasos manuales. En el PR, pasos para probarlo a mano
compartiendo una vacante desde LinkedIn en iPhone (TestFlight). La prueba en
dispositivo y la configuración del portal de Apple quedan para Héctor.

- **Model**: claude/opus
- **Estimate**: 6h
- **Reason**: Target nativo de Xcode y firma en CI; errores caros de diagnosticar.
- **Dependencies**: F14.2.T1
- **Files**:
  - `apps/mobile/ios/Runner.xcodeproj/project.pbxproj`
  - `apps/mobile/ios/Runner/Runner.entitlements`
  - `apps/mobile/ios/Runner/Info.plist`
  - `apps/mobile/ios/ShareExtension/`
  - `codemagic.yaml`
  - `docs/runbooks/despliegue.md`
