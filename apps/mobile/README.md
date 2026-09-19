# Fluent — app móvil

App Flutter de práctica de inglés conversacional por voz (SPEC-06). Este README cubre cómo
levantar el proyecto y conectarlo a la API real; la guía completa para probarlo en un teléfono
está en `docs/runbooks/probar-app-movil.md` (raíz del repo).

## Preparar el proyecto

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter gen-l10n
```

`build_runner` genera los modelos (`freezed`/`json_serializable`); `gen-l10n` genera las
traducciones a español y portugués desde `lib/l10n/app_es.arb` y `app_pt.arb`. Repetir ambos
comandos cada vez que cambien los modelos de `core/api/models.dart` o las claves `.arb`.

## Configuración con `--dart-define-from-file`

La app no lleva secretos ni URLs reales en el repo: todo llega por `--dart-define`. Copiá
`defines.example.json` a `defines.json` (ignorado por git, nunca se commitea) y completá los
valores reales:

```bash
cp defines.example.json defines.json
```

```json
{
  "API_URL": "https://fluent-api.example.com/v1",
  "INSFORGE_URL": "https://xyz.us-east-1.insforge.app",
  "INSFORGE_ANON_KEY": "anon_PEGA_AQUI",
  "USE_FAKE_API": "false"
}
```

| Clave | Qué es | Por defecto si falta |
|---|---|---|
| `API_URL` | Base de la API de Fluent (NestJS), sin barra final | `https://fluent-api.local/v1` |
| `INSFORGE_URL` | Base del proyecto InsForge usado para auth | `https://insforge.local` |
| `INSFORGE_ANON_KEY` | Anon key de InsForge (SPEC-06 §6). Sin ella, alta/login/refresh fallan con `AUTH_INVALID_CREDENTIALS "No token provided"` | vacío |
| `USE_FAKE_API` | `"true"` usa `FakeApi` (datos de ejemplo, sin red); `"false"` usa la API real | `"false"` desde T9 |

Correr o compilar con esos valores:

```bash
flutter run --dart-define-from-file=defines.json
flutter build apk --release --dart-define-from-file=defines.json
```

Para desarrollar pantallas sin backend (`FakeApi`), sin tocar `defines.json`:

```bash
flutter run --dart-define=USE_FAKE_API=true
```

Los tests (`flutter test`) nunca dependen de estos defines: cada test que necesita datos instancia
`FakeApi()` explícitamente y lo inyecta con `fluentApiProvider.overrideWith(...)`.

## Comandos de verificación

```bash
flutter analyze
flutter test
```

Ambos deben pasar sin avisos antes de cualquier commit (ver `docs/tasks/PR-06-app-movil.md`).

## Release y tiendas

Firma de Android (`android/key.properties` + keystore de subida, ambos fuera del repo), builds
de release, Firebase y los pasos en Play Console y App Store Connect:
`docs/runbooks/stores.md`.

## Checklist de prueba manual en dispositivo

`flutter analyze` y `flutter test` no reemplazan una prueba en un teléfono real: reconocimiento de
voz con acento, texto a voz, el deep link de PKCE de OpenRouter y las notificaciones locales no se
pueden probar en este VPS (no hay emulador ni dispositivo). La checklist completa, pendiente de
que el operador la ejecute en su Mac y su teléfono, está en
`docs/runbooks/probar-app-movil.md`.
