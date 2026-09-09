# Probar la app móvil de Fluent en tu teléfono

Guía para el operador. Todo lo que dice "en el VPS" ya está hecho; lo que dice "en tu Mac" o "en el teléfono" lo haces tú.

## 0. Lo que ya está listo en el servidor

| Pieza | Valor |
|---|---|
| API | `https://fluent.usebot.chat/v1` (salud en `/v1/health`) |
| InsForge | `https://c4jzbm8x.us-east.insforge.app` |
| Tu cuenta | `knaimero@gmail.com`, contraseña temporal en `/root/.config/fluent/operador.env` del VPS (cámbiala tras entrar) |
| Tu grupo | "Fluent Crew", con tu perfil ya dentro como owner |
| Códigos de invitación para amigos (30 días) | `THN9LNBF` `WWQE4AN2` `VK8SH2XV` `FHZ2UZLE` `792ACQG8` `SDBLY6NM` |
| Anon key de InsForge | en `apps/api/.env` del VPS, variable `INSFORGE_ANON_KEY` (empieza por `anon_`) |

## 1. Requisitos en tu Mac

1. Flutter 3.47 estable: `flutter --version`. Si no lo tienes, https://docs.flutter.dev/get-started/install/macos.
2. Para Android: Android Studio con SDK y `adb`. Para iPhone: Xcode con tu cuenta de desarrollador (gratuita sirve para instalar en tu propio teléfono 7 días).
3. `flutter doctor` sin errores en la plataforma que vayas a usar.
4. Teléfono con depuración USB activada (Android) o desbloqueado y confiando en la Mac (iPhone).

## 2. Obtener el código

```bash
git clone https://github.com/hectorcanaimero/fluent.git
cd fluent/apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter gen-l10n
```

El último paso genera las traducciones a español y portugués.

## 3. Variables de la app

Crea un archivo `apps/mobile/defines.json` (está ignorado por git) con:

```json
{
  "API_URL": "https://fluent.usebot.chat/v1",
  "INSFORGE_URL": "https://c4jzbm8x.us-east.insforge.app",
  "INSFORGE_ANON_KEY": "anon_PEGA_AQUI",
  "USE_FAKE_API": "false"
}
```

Obtén la anon key en el VPS con:

```bash
grep INSFORGE_ANON_KEY /root/projects/fluent/apps/api/.env
```

## 4. Instalar en el teléfono

Conecta el teléfono y comprueba que aparece: `flutter devices`.

**Android, instalación directa:**
```bash
flutter run --release --dart-define-from-file=defines.json
```
O genera el APK y pásalo por AirDrop o cable:
```bash
flutter build apk --release --dart-define-from-file=defines.json
# resultado: build/app/outputs/flutter-apk/app-release.apk
```

**iPhone:**
```bash
open ios/Runner.xcworkspace
```
En Xcode: selecciona tu iPhone, en Signing elige tu equipo, y ejecuta. Si Xcode pide permisos de micrófono y reconocimiento de voz, ya están declarados en `Info.plist`.

Si quieres ver logs mientras pruebas: `flutter run --dart-define-from-file=defines.json` sin `--release`.

## 5. Primer uso, en orden

1. **Entrar** con `knaimero@gmail.com` y la contraseña temporal. No hace falta código de invitación: tu perfil ya está en el grupo.
2. **Onboarding**: nombre, nivel y 3 a 5 intereses. Elige el idioma de la app si no coincide con el del teléfono.
3. **Conectar un proveedor**. Recomendado: Gemini. Genera la key gratis en https://aistudio.google.com/apikey y pégala en la pantalla de proveedores. Alternativa: "Conectar OpenRouter", que abre el navegador y vuelve a la app solo.
4. **Elegir modelos**: deja el gratuito para conversar y para el coach, o sube el del coach si tienes crédito.
5. **Practicar 10 min**: elige un tema, habla en inglés, revisa la transcripción, envía. Comprueba que aparecen respuestas y algún chip de corrección.
6. **Terminar la sesión**: revisa XP, streak y correcciones en el resumen.
7. **Memoria**: a los 1 o 2 minutos del cierre, en "Lo que recuerdo de vos" deben aparecer hechos pendientes para confirmar. Si no aparecen, revisa el worker (sección 7).
8. **Grupo**: verás tu leaderboard con un solo miembro hasta que entre un amigo.

## 6. Invitar a un amigo

Pásale un código de la tabla de arriba. En la app: "Crear cuenta" con su email, contraseña y el código. Cada código sirve una vez. Para generar más, desde la app del owner o pidiéndomelo.

## 7. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| "No se pudo conectar" al entrar | `curl https://fluent.usebot.chat/v1/health` desde la Mac. Debe responder `ok: true`. |
| Error al registrar o entrar | Comprueba `INSFORGE_ANON_KEY` en `defines.json`: InsForge rechaza el alta sin ella. |
| El tutor no responde | Pantalla de proveedores: estado de la conexión y crédito. Si Gemini da cuota agotada, espera un minuto o cambia de modelo. |
| No aparecen hechos en Memoria | Worker en Coolify: aplicación `fluent-worker`, pestaña Logs. Debe decir "procesadores de colas activos". |
| El micrófono no transcribe | Ajustes del teléfono: idioma de reconocimiento inglés (EE. UU.) descargado. Usa el modo texto mientras. |
| Logs de la API | Coolify, aplicación `fluent-api`, Logs. O `docker logs` del contenedor `e2gqrg6tp7e4ms1gl8evclnt-…` en el VPS. |

## 8. Qué quiero saber de tu prueba

Anota, aunque sea en dos líneas cada uno: cuánto tardó el tutor en responder, si las correcciones tenían sentido, si el reconocimiento de voz entendió tu acento, y qué pantalla te resultó confusa. Con eso ajusto prompts, modelos y UI.

## 9. Checklist de la prueba manual en dispositivo (pendiente de ejecutar)

`flutter analyze` y `flutter test` corren en el VPS y ya están en verde, pero no reemplazan una
prueba en un teléfono real: no hay emulador ni dispositivo conectado en el VPS, así que nadie
ejecutó todavía lo siguiente. Ningún resultado de esta lista está verificado — la marca cada
casilla el operador, en su Mac y su teléfono, siguiendo los pasos de las secciones 4 y 5.

- [ ] **Reconocimiento de voz (STT, SPEC-06 §5).** En `/session/:id`, mantener presionado el botón
  de micrófono y hablar en inglés con acento hispano. Verificar: aparece transcripción parcial
  mientras se habla; al soltar, el texto final queda editable con botones "Enviar" y "Repetir"; si
  el teléfono no tiene el paquete de reconocimiento `en_US` instalado, la app lo indica y ofrece el
  modo texto en vez de trabarse.
- [ ] **Texto a voz (TTS, SPEC-06 §5).** Tras un turno del tutor, tocar el botón de repetir audio
  con cada velocidad (0.8x, 1x, 1.2x). Verificar: se escucha con voz en inglés; al tocar el
  micrófono para responder, el audio del tutor se corta al instante (ducking, no se solapan).
- [ ] **PKCE de OpenRouter (SPEC-06 §7).** En `/providers`, tocar "Conectar" en la tarjeta de
  OpenRouter. Verificar: abre el navegador externo (no un WebView embebido); tras iniciar sesión en
  OpenRouter, vuelve solo a la app por el deep link `fluent://oauth/openrouter` (sin que el usuario
  copie ni pegue nada); la tarjeta pasa a "Conectado" sin recargar la app a mano.
- [ ] **Notificaciones locales (SPEC-06 §8).** En `/settings`, configurar los dos recordatorios
  diarios. Verificar: llegan a la hora configurada aunque la app esté cerrada; si ya se completaron
  dos sesiones ese día, el recordatorio de esa franja no llega (SPEC-06 §8: "canceladas el día en
  que ya se hicieron dos sesiones").
- [ ] **Sesión real de punta a punta (criterio de aceptación de T9).** Una sesión completa de 10
  minutos con al menos una corrección mostrada en el resumen y un hecho nuevo en "Lo que recuerdo
  de vos" (sección 5, pasos 5 y 7) con dos usuarios reales (el owner y un invitado con uno de los
  códigos de la sección 6).

Reportar en un párrafo por casilla (o "no lo pude probar, esto pasó" si algo falla) usando el
formato de la sección 8.
