# Pendientes y decisiones sin spec — PR-06 app móvil

Cosas que la spec o el diseño no cubrían y se resolvieron con la opción
más simple durante la construcción de `apps/mobile`. Se listan para que
el operador las revise o las mejore más adelante.

## T1 — Esqueleto

- **Riverpod sin codegen.** SPEC-06 §1 lista `flutter_riverpod` y
  `riverpod_annotation`. Se usó solo `flutter_riverpod` (providers
  escritos a mano) para no sumar un segundo generador de código
  (`riverpod_generator`) junto a `freezed`/`json_serializable`. Los
  providers son igual de tipados y testeables; si más adelante se
  quiere el azúcar de `@riverpod`, es un cambio mecánico.
- **Portugués como `pt` en vez de `pt_BR`.** Los ARB son
  `app_es.arb`/`app_pt.arb` (como pide la tarea). `gen-l10n` exige que
  el `@@locale` del archivo coincida con el sufijo del nombre; como
  solo soportamos una variante de portugués, se usó `pt` en vez de
  `pt_BR`. Un dispositivo con `pt_BR` cae en `pt` por el resolución de
  locale por defecto de Flutter (coincide el idioma). Si el día de
  mañana hace falta portugués europeo también, ahí sí se necesita
  `pt_BR` explícito y este archivo pasa a `app_pt_BR.arb`.
- **Fuente Plus Jakarta Sans no incluida.** El diseño la especifica,
  pero no hay archivos de fuente en el repo ni licencia verificada.
  `app/theme.dart` referencia la familia `PlusJakartaSans`; sin los
  archivos declarados en `pubspec.yaml` (`fonts:`), Flutter cae en la
  fuente del sistema. El operador debe conseguir los `.ttf` (Google
  Fonts, OFL) y declararlos.
- **`freezed`/`build_runner` actualizados más allá de lo fijado en
  SPEC-06.** La versión que resolvía `pubspec.yaml` originalmente
  (`freezed ^2.5.7`) traía un `analyzer` transitivo (7.7.1) más viejo
  que el lenguaje de Dart 3.13 del SDK del VPS, lo que rompía
  `build_runner` al analizar el propio Flutter SDK. Se subió a
  `freezed ^4.0.1` / `build_runner ^2.16.1` / `json_serializable
  ^6.14.1`, que resuelven un `analyzer` compatible. Esto también obliga
  a declarar las clases `@freezed` como `abstract class` (sintaxis de
  Freezed 3+), distinto de los ejemplos con Freezed 2.x que puedan
  encontrarse en otros repos.

## T3 — Onboarding

- **Zona horaria por defecto.** SPEC-06 §1 no incluye ningún paquete
  de detección de zona horaria IANA (algo como `flutter_timezone`).
  `dart:core` solo da la abreviatura (`ART`, no
  `America/Argentina/Buenos_Aires`). Hasta que se agregue esa
  dependencia, el onboarding manda siempre
  `America/Argentina/Buenos_Aires` como zona horaria del perfil. Esto
  afecta el cálculo de "día" para streaks (SPEC-01) si el usuario está
  en otro huso horario.
- **"Placement chat de 1 minuto" (paso Nivel).** Marcado P2 en
  `docs/design/README.md`. No se implementó ningún flujo real; si se
  agrega el texto en el futuro, debe ir con su propia pantalla y no
  como una promesa vacía.
- **Paso 4 (conectar proveedor) condicional.** La tarea dice "salto a
  la pantalla de proveedores en el paso 4", pero el criterio de
  aceptación dice "al terminar navega a `/`". Se resolvió así: al
  terminar el paso de intereses, si el usuario ya tiene algún proveedor
  `connected` (poco común recién registrado, pero es el caso de los
  datos de ejemplo de `FakeApi`), se va directo a `/`; si no tiene
  ninguno, se salta a `/providers`. Documentado en el commit de T3.

## T4 — Proveedores y modelos

- **Crédito de OpenRouter viene de `GET /providers/:provider/status`,
  no de `GET /me`.** SPEC-02 §4.1 no incluye `credits` en la forma de
  `providers` que devuelve `/me`; solo aparece en el endpoint de
  estado por proveedor (§4.2). La pantalla pide el status de cada
  proveedor conectado además de `/me` para poder mostrar el crédito
  restante.
- **`Info.plist` con `CFBundleURLTypes` para `fluent://`.** El propio
  README de `flutter_web_auth_2` dice que en iOS no hace falta
  declarar el esquema porque `ASWebAuthenticationSession` intercepta
  el redirect directamente. Se declaró igual (SPEC-06 lo pide
  explícitamente) por si algo abre el link fuera de ese flujo; no
  debería tener efecto contrario.
- **`OAuthLauncher` como capa propia sobre `flutter_web_auth_2`.** No
  está en la spec, pero es necesario para poder simular el login de
  OpenRouter en tests y con `USE_FAKE_API=true` sin abrir un
  navegador real (mismo patrón que se va a usar para voz en T6 con
  `SpeechService`/`TtsService`).
