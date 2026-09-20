# Publicar en Google Play y App Store

Cómo sacar el build de release de Open Fluent y qué hay que hacer en cada consola. Todo lo que
es secreto (keystore, contraseñas, certificados) queda **fuera del repo**.

## Datos de la app

| | Android | iOS |
|---|---|---|
| Identificador | `com.guria.openfluent` (`applicationId`) | `com.guria.openfluent` (`PRODUCT_BUNDLE_IDENTIFIER`) |
| Nombre visible | Open Fluent | Open Fluent |
| Versión | `version:` de `apps/mobile/pubspec.yaml` (`0.1.0+1` → versionName `0.1.0`, versionCode `1`) | igual: `CFBundleShortVersionString` / `CFBundleVersion` |
| Mínimo | minSdk 24 · targetSdk 36 | iOS 15.0 |

El identificador no se puede cambiar después de publicar. Tiene que coincidir con el de los
archivos de Firebase.

**Cada subida necesita un número de build mayor**: subí el `+N` de `version:` en `pubspec.yaml`
(por ejemplo `0.1.0+2`) antes de cada build que vaya a las tiendas.

## Firebase

Productos activos: Crashlytics, Analytics y Messaging (push).

- `apps/mobile/android/app/google-services.json`
- `apps/mobile/ios/Runner/GoogleService-Info.plist` (ya está agregado al target Runner)

Se bajan de la consola de Firebase → Configuración del proyecto → cada app.

**Los dos archivos van commiteados en el repo**: son identificadores del proyecto, no secretos
(la API key que traen está restringida al package y al bundle id). Por eso `.gitignore` no los
excluye y Codemagic los usa tal cual. Las variables `GOOGLE_SERVICES_JSON` y
`GOOGLE_SERVICE_INFO_PLIST` del grupo `fluent_prod` quedan **solo como alternativa** por si
alguna vez se decide sacarlos del repo: el workflow solo las usa si el archivo no está.

Firebase se inicializa solo en Android/iOS con la API real (`USE_FAKE_API=false`); en web y en
modo fake no se usa. Crashlytics no envía nada en debug.

## Android (Google Play)

### 1. Keystore de subida (una sola vez, en tu máquina)

```bash
keytool -genkey -v -keystore ~/open-fluent-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Guardalo con su contraseña en un gestor de contraseñas: si se pierde, hay que pedirle a Google
que resetee la clave de subida.

Creá `apps/mobile/android/key.properties` (está en `.gitignore`):

```properties
storeFile=/ruta/absoluta/a/open-fluent-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Sin ese archivo, el release se firma con la clave de debug y Play lo rechaza.

### 2. Build

```bash
cd apps/mobile
flutter build appbundle --release --dart-define-from-file=defines.json
# → build/app/outputs/bundle/release/app-release.aab
```

### 3. Play Console

1. Crear la app ("Open Fluent", idioma predeterminado español) y activar **Play App Signing**
   (Google guarda la clave de firma; vos subís con la de subida).
2. Subir el `.aab` a **Prueba interna** primero.
3. Completar la ficha: descripción, capturas de teléfono, ícono 512×512, gráfico de 1024×500.
4. **Seguridad de los datos**: declarar lo que recolecta Firebase (identificadores del
   dispositivo, datos de fallas y de uso para Crashlytics/Analytics) y el texto de las
   conversaciones que se envía al tutor. No se guarda audio.
5. Política de privacidad (URL pública), clasificación de contenido, público objetivo
   (adultos) y permisos sensibles: `RECORD_AUDIO` (hablar con el tutor) y
   `SCHEDULE_EXACT_ALARM` (recordatorios a la hora elegida).
6. Pasar de prueba interna a cerrada/producción cuando esté probado en teléfonos reales.

## iOS (App Store)

Se hace en una Mac con Xcode. Nada de certificados ni perfiles va al repo.

### 1. Apple Developer

1. **Identifiers** → registrar `com.guria.openfluent` con la capacidad **Push Notifications**.
2. **Keys** → crear una clave APNs (.p8) y subirla a Firebase → Configuración del proyecto →
   Cloud Messaging → app iOS. Sin esto no llegan los push.
3. En Xcode (`apps/mobile/ios/Runner.xcworkspace`) → Runner → Signing & Capabilities: elegir
   el Team, firma automática, y comprobar que aparezcan **Push Notifications** y **Background
   Modes → Remote notifications** (el proyecto ya trae `Runner.entitlements` y
   `UIBackgroundModes`).

### 2. Build

```bash
cd apps/mobile
flutter build ipa --release --dart-define-from-file=defines.json
# → build/ios/ipa/*.ipa
```

Subirlo con **Transporter** o desde Xcode (Product → Archive → Distribute App). En los builds
release, la fase "Upload Crashlytics Symbols" sube los dSYM a Crashlytics (si no encuentra el
script, avisa y sigue).

### 3. App Store Connect

1. Crear la app con el bundle id `com.guria.openfluent` y SKU propio.
2. **Privacidad de la app**: declarar los datos de Firebase (diagnóstico y uso, identificadores)
   y el contenido de usuario (texto de las conversaciones). No se guarda audio.
3. Probar con **TestFlight** antes de enviar a revisión.
4. Para la revisión: cuenta de prueba (login con Google) y una nota que explique que hace falta
   una cuenta de IA gratuita (OpenRouter o Gemini) para las sesiones, o que existe la sesión de
   cortesía.
5. Los textos de permisos (micrófono y reconocimiento de voz) ya están en inglés, español y
   portugués (`ios/Runner/{en,es,pt}.lproj/InfoPlist.strings`).

## Codemagic (recomendado)

El VPS no tiene Mac, así que los builds de release se hacen en Codemagic con
`codemagic.yaml` (raíz del repo). Hay dos workflows, que corren en `apps/mobile`:

| Workflow | Máquina | Hace | Publica en |
|---|---|---|---|
| `android-release` | Linux | tests, `flutter build appbundle --release` firmado | Google Play, pista **internal** |
| `ios-release` | Mac mini M2 | tests, `flutter build ipa --release` firmado | App Store Connect → **TestFlight** |

Los dos se disparan con un tag `v*` o a mano desde Codemagic. Este archivo no se puede correr
desde el servidor: validé la sintaxis del YAML, pero la primera corrida real va a mostrar si falta
algo de la configuración de la cuenta.

### 1. Conectar el repo

Codemagic → **Add application** → GitHub → elegir el repo → tipo **Flutter App** →
"codemagic.yaml". Codemagic lee el archivo de la rama o del tag que se construye.

### 2. Grupo de variables `fluent_prod`

Codemagic → Team settings → **Global variables and secrets** → crear el grupo `fluent_prod`
(todas como *secure*):

| Variable | Valor |
|---|---|
| `API_URL` | URL de producción de la API (con `/v1`) |
| `INSFORGE_URL` | URL del proyecto de InsForge |
| `INSFORGE_ANON_KEY` | anon key de InsForge |
| `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` | el JSON completo de la cuenta de servicio de Google Play (paso 3) |
| `APP_STORE_APPLE_ID` | el Apple ID numérico de la app en App Store Connect (App Information) |
| `GOOGLE_SERVICES_JSON` | opcional (hoy no hace falta: el archivo está en el repo). Alternativa: `base64 -w0 google-services.json` |
| `GOOGLE_SERVICE_INFO_PLIST` | ídem para `GoogleService-Info.plist` |

`USE_FAKE_API=false` lo fija el workflow. `defines.json` no se usa en Codemagic.

### 3. Android

1. **Keystore:** Team settings → Code signing identities → **Android keystores** → subir
   `open-fluent-upload.jks` con su contraseña, alias `upload` y **nombre de referencia
   `open_fluent_upload`** (el que usa el YAML). Gradle toma las variables `CM_KEYSTORE_*` que
   inyecta Codemagic cuando no hay `key.properties`.
2. **Cuenta de servicio de Google Play:** en Google Cloud (proyecto vinculado a Play Console)
   crear una cuenta de servicio y una clave JSON; en Play Console → Usuarios y permisos,
   invitarla con permiso para publicar en pistas de prueba. Pegar el JSON en
   `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`.
3. **La primera versión se sube a mano** en Play Console (la API de Play no puede crear la app
   ni su primer release): generá un AAB firmado (localmente o descargando el artefacto de una
   corrida de Codemagic) y subilo a la pista interna. A partir de ahí, Codemagic publica solo.

El versionCode es el último subido a Play + 1 (si la consulta falla, el contador de builds de
Codemagic).

### 4. iOS

1. **App Store Connect API key:** App Store Connect → Usuarios y acceso → Integraciones →
   **App Store Connect API** → crear una clave con rol *App Manager*. Anotar el **Issuer ID**, el
   **Key ID** y bajar el `.p8`.
2. En Codemagic → Team settings → Team integrations → **Developer Portal** → agregar la clave
   con el nombre **`Open Fluent ASC`** (el que usa el YAML).
3. En el portal de Apple Developer, el bundle id `com.guria.openfluent` tiene que estar
   registrado con **Push Notifications** (ver la sección iOS de arriba). Codemagic genera o
   descarga el certificado de distribución y el perfil App Store con esa clave.
4. El proyecto usa Swift Package Manager (no CocoaPods): el workflow no corre `pod install`.

El número de build es el último de TestFlight + 1 (si no hay `APP_STORE_APPLE_ID` o la consulta
falla, el contador de Codemagic).

### 5. Avisos por correo

Codemagic avisa del resultado a la dirección de tu cuenta. En `codemagic.yaml`
no se configuran destinatarios: la sección `publishing.email` se valida antes
de cargar el grupo de variables, así que una variable como `$NOTIFY_EMAIL`
llega vacía y el build falla con
«recipients -> 0: none is not an allowed value». Si querés avisar a más
direcciones, escribilas literales.

### 6. Publicar una versión

```bash
# 1. Subir la versión visible en apps/mobile/pubspec.yaml, por ejemplo:
#    version: 1.0.0+1   (el +N lo reemplaza Codemagic)
git commit -am "chore(mobile): versión 1.0.0"
# 2. Etiquetar y empujar: dispara los dos workflows.
git tag v1.0.0 && git push && git push --tags
```

Android queda en la pista interna de Play y iOS en TestFlight. Pasar a producción se hace a mano
en cada consola.

## Qué no se puede verificar desde el servidor

El VPS no tiene Xcode ni teléfonos: el build de iOS (ahora vía Codemagic), las corridas de
`codemagic.yaml`, el envío real de push y los reportes de Crashlytics hay que probarlos en
Codemagic y en dispositivos. Ver también
`docs/runbooks/probar-app-movil.md`.
