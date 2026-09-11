# SPEC-06 — App móvil (Flutter)

Estado: borrador v0.1 · Cubre: RF-1.x, RF-2.1, RF-2.3, RF-2.6, RF-3.x, RF-4.2, RF-4.6, RF-5.x, RF-6.x · ADR 0003

## 1. Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Flutter | 3.47 estable, Dart 3 | ya instalado en el VPS |
| Estado | Riverpod 2 (`flutter_riverpod` 2.x, sin `riverpod_annotation` ni codegen) | providers a mano; las pantallas usan `FutureProvider`/`StateNotifier` y, donde el estado es local, `setState`. Decidido en el P1 (MEJ-22): migrar a Riverpod 3 con codegen no aporta hoy y costaría reescribir las pantallas |
| Navegación | `go_router` | rutas declarativas y deep links para el callback de PKCE |
| HTTP | `dio` con interceptores | refresh automático de token, logs |
| Modelos | `freezed` + `json_serializable` | DTOs inmutables |
| Almacenamiento seguro | `flutter_secure_storage` | tokens |
| Voz | `speech_to_text`, `flutter_tts` | ADR 0003 |
| Navegador externo | `flutter_web_auth_2` | PKCE de OpenRouter con retorno por esquema `fluent://` |
| Compartir | `share_plus` | resumen semanal |
| Notificaciones locales | `flutter_local_notifications` | recordatorios sin backend (pregunta abierta 4 del PRD) |
| i18n | `flutter_localizations` + `intl` con archivos ARB | español y portugués de Brasil; detección del sistema y cambio en ajustes |

Sin SDK de InsForge para Dart: se implementa un `InsforgeAuthClient` mínimo por REST (§6).

**Diseño:** las pantallas siguen `docs/design/fluent.pen`. Tokens, componentes, correspondencia con estas rutas y pantallas que faltan están en `docs/design/README.md`. Tipografía Plus Jakarta Sans, color primario #0E9C8C, acento #F0813B, radios 20/14/999, padding de pantalla 20.

## 2. Estructura

```
apps/mobile/lib/
  main.dart
  app/            router, tema, bootstrap
  core/           http (dio), storage, errores, formato, constantes
  features/
    auth/         login, registro, invitación
    onboarding/   nombre, nivel, intereses, proveedor
    home/         resumen, botón de sesión, streak
    session/      selector, conversación, voz, cierre
    memory/       "Lo que recuerdo de vos", brief
    providers/    conexión OpenRouter y Gemini, selector de modelos
    progress/     XP, correcciones, tendencia
    group/        leaderboard, desafíos, resumen semanal
    settings/     perfil, zona horaria, borrar cuenta
```

Cada feature: `data/` (API), `domain/` (modelos), `presentation/` (pantallas y widgets), `providers.dart`.

## 3. Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/login` | email y contraseña, enlace a registro | anónimo |
| `/register` | email, contraseña, código de invitación | anónimo |
| `/onboarding/*` | 4 pasos: nombre, nivel, intereses, proveedor | autenticado sin `onboarded` |
| `/` | Home | onboarded |
| `/session/new` | elegir tipo y tema | onboarded |
| `/session/:id` | conversación | onboarded |
| `/session/:id/summary` | cierre | onboarded |
| `/memory` | hechos y brief | onboarded |
| `/providers` | proveedores y modelos | onboarded |
| `/progress` | progreso | onboarded |
| `/group` | leaderboard y semana | onboarded |
| `/settings` | ajustes | onboarded |
| `fluent://oauth/openrouter` | deep link de retorno PKCE | interno |

**Barra de pestañas:** Home · Practicar · Grupo · Progreso. El perfil y los ajustes se abren desde el avatar en la cabecera de Home. El diseño de Pen muestra Home · Practice · Progress · Profile; se sustituye Profile por Grupo.

Redirección global en el router según `authState`: sin token → `/login`; con token y sin `onboarded` → `/onboarding`; sesión activa pendiente (`GET /me` devuelve `activeSessionId`) → `/session/:id`.

El arranque solo cierra la sesión si `GET /me` responde `401`. Cualquier otro fallo (sin red, timeout, 5xx) conserva los tokens y deja `authState` en `error`, que el router manda al splash con «No pudimos conectar» y un botón **Reintentar**. Ese estado es exclusivo del arranque: un `/me` fallido en un refresco en caliente (tras conectar un proveedor o terminar el onboarding) no saca al usuario de la pantalla en la que está. Si el refresco de token falla ante un `401`, `ApiClient` borra los tokens y avisa por `onSessionExpired`, y `AuthController` pasa a `unauthenticated` para que el router vaya a `/login`. Al llegar al resumen de una sesión se limpia el `activeSessionId` local, si no el router seguiría empujando a la conversación ya cerrada.

## 4. Pantallas clave

### 4.1 Home
- Saludo con nombre, streak con llama y "día de gracia disponible" si aplica.
- Botón grande "Practicar 10 min". Si `bossPending`, el botón cambia a "Boss battle" con opción "Hoy no".
- Tarjeta "Tu grupo esta semana": top 3 del leaderboard y tu posición.
- Si hay `pendingFacts > 0`: tarjeta "Tengo 2 cosas nuevas que recordar de vos, ¿las revisás?".
- Si `providers` sin ninguno `active`: banner bloqueante "Conectá un proveedor para practicar".

### 4.2 Nueva sesión
Tres pestañas: Temas (chips sugeridos + campo libre), Roleplay (4 tarjetas), Noticias (4 titulares con fuente). Toque → `POST /sessions` → `/session/:id`.

### 4.3 Conversación
- Cabecera: temporizador `mm:ss` regresivo desde 10:00, tipo de sesión, botón terminar.
- Lista de burbujas. Turno del tutor con botón de repetir audio y control de velocidad (0.8x, 1x, 1.2x). Turno del usuario con chip "1 corrección" que expande original tachado, corregido y nota.
- Zona inferior: botón de micrófono grande (mantener para hablar o toque para iniciar/parar, configurable). Mientras escucha, muestra transcripción parcial. Al soltar, la transcripción queda en un campo editable con "Enviar" y "Repetir". Botón de teclado para modo texto (RF-3.3).
- Estados: `idle`, `listening`, `reviewing`, `sending`, `speaking`. Mientras `sending` o `speaking`, el micrófono está deshabilitado.
- A los 8:00 un toast "2 minutos". A 0:00, tras el turno en curso, llama `/end` y navega al resumen.
- Si `degraded` en la respuesta: chip discreto "Usé un modelo alternativo". Si `unavailable` 3 veces: diálogo para terminar.

### 4.4 Resumen de sesión
XP ganado con animación, streak, correcciones agrupadas por categoría, "Terminaste en 9:40", botón "Volver". Si `nextIsBoss`, aviso.

### 4.5 Memoria (RF-4.2, RF-4.6)
- Sección "Para confirmar": lista con texto editable inline, botones ✓ y ✕.
- Sección "Lo que recuerdo": hechos confirmados, deslizar para borrar, toque para editar.
- Todos los textos pasan por `AppLocalizations`; nunca hay cadenas literales en widgets. Una clave nueva se añade en `es` y `pt` en el mismo commit.
- Sección "Notas del coach": texto del brief editable, con explicación de que el tutor lo lee antes de cada sesión.
- Botón "Olvidar todo" con confirmación doble.

### 4.6 Proveedores y modelos (RF-2.1, RF-2.3, RF-2.6, RF-2.7)
- Tarjeta OpenRouter: estado, crédito restante si hay, "Conectar" (PKCE) o "Desconectar".
- Tarjeta Gemini: estado, "Pegar API key" con enlace a aistudio.google.com/apikey y ayuda en 3 pasos. Recomendado con etiqueta.
- Selector "Modelo para conversar" y "Modelo para el coach": listas agrupadas Gratis / Económico / Premium con precio por millón y "≈ 0,004 USD por sesión". Los modelos de un proveedor no conectado aparecen deshabilitados.

### 4.7 Grupo
Leaderboard semanal con medalla al primero, streak grupal, desafíos ("Ana practicó sobre viajes, ¿te animás?" → abre nueva sesión con ese tema), y tarjeta del resumen semanal con botón "Compartir en WhatsApp" (`share_plus`).

## 5. Voz (ADR 0003)

- `speech_to_text.listen(localeId: 'en_US', listenMode: dictation, partialResults: true, pauseFor: 3s, listenFor: 45s)`.
- Si el dispositivo no tiene `en_US`, mostrar cómo instalarlo y ofrecer modo texto.
- `flutter_tts`: `setLanguage('en-US')`, voz por defecto del sistema, `setSpeechRate` según control; `awaitSpeakCompletion(true)` para encadenar estados.
- Ducking de audio: al empezar a escuchar, detener TTS.
- Permiso de micrófono se pide al entrar por primera vez a `/session/new`, con pantalla explicativa antes del diálogo del sistema.

## 6. Auth e InsForge por REST

```
POST {INSFORGE_URL}/api/auth/users?client_type=mobile      { email, password, name }
POST {INSFORGE_URL}/api/auth/sessions?client_type=mobile   { method:'password', email, password }
POST {INSFORGE_URL}/api/auth/refresh?client_type=mobile    { refreshToken }
POST {INSFORGE_URL}/api/auth/logout                         Authorization: Bearer
```

- **Todas las llamadas a InsForge sin sesión (alta, inicio de sesión, refresh) llevan `Authorization: Bearer <INSFORGE_ANON_KEY>`**; InsForge responde `AUTH_INVALID_CREDENTIALS "No token provided"` si falta. La anon key viaja en la app como `--dart-define=INSFORGE_ANON_KEY`. Verificado el 2026-09-09 contra el proyecto real.
- `accessToken` en memoria y en `flutter_secure_storage`; `refreshToken` solo en secure storage.
- Interceptor de `dio`: en 401 de la API, refresca una vez con lock y reintenta; si el refresh falla, cierra sesión.
- Registro: primero `users` en InsForge, luego `POST /invitations/redeem` en la API con el código; si el código falla, la cuenta queda creada pero sin grupo y la app vuelve a pedirlo en onboarding.
- Verificación de email: según `metadata.requireEmailVerification`; en v1 se desactiva en la configuración del proyecto para reducir fricción en un grupo cerrado.

## 7. PKCE con OpenRouter (RF-2.1)

1. App → `POST /providers/openrouter/pkce/start { callbackUrl: 'fluent://oauth/openrouter' }`.
2. Abre `authUrl` con `flutter_web_auth_2` (`callbackUrlScheme: 'fluent'`).
3. Recibe `fluent://oauth/openrouter?code=...` → `POST /providers/openrouter/pkce/complete { code, codeVerifierId }`.
4. Refresca `/me` y navega a la selección de modelo.

El `code_verifier` nunca está en el dispositivo; lo genera y guarda la API (SPEC-02 §4.2), así la key resultante nunca pasa por la app.

## 8. Recordatorios locales

Dos notificaciones diarias configurables en ajustes (por defecto 08:30 y 20:30 hora local), programadas con `flutter_local_notifications`, canceladas el día en que ya se hicieron dos sesiones. Sin backend.

## 9. Seguridad y privacidad

- Nada de la conversación se guarda localmente salvo la sesión en curso en memoria.
- Logs de `dio` desactivados en release.
- Borrar cuenta: `DELETE /me` en la API (borra datos por cascada) y luego `logout` en InsForge.

## 10. Tests

- Unit: parsers de DTO, máquina de estados de voz, temporizador.
- Widget: pantalla de conversación con API falsa (`dio` mock): flujo escuchar → editar → enviar → mostrar corrección.
- Integración manual en dispositivo real: STT con acento, ducking, deep link PKCE.
