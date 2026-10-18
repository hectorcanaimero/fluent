---
type: spec
project_id: fluent
phase: 11
version: 0.1
depends_on:
  - docs/arch/003-simulador-entrevistas.md
  - docs/prd/003-simulador-entrevistas.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-10-18
title: Simulador de entrevistas — app, entrada y preparación
---

# F11 — App: entrada, preparación y plan

El usuario pega una oferta, ve cómo se prepara su entrevista y el resumen del
plan, y encuentra sus entrevistas en el historial.

Arquitectura: `docs/arch/003-simulador-entrevistas.md`, C6 e I2. Diseño:
`docs/design/fluentv3.pen`, frames IE-01, IE-01a–d, IE-02, IE-03, IE-03a–b,
IE-04 e IE-09 (reutilizar componentes y tokens existentes). Textos: español
neutro latinoamericano con tuteo ("Pega una oferta", "Puedes salir"), nunca
voseo, y pt-BR, en `app_es.arb` y `app_pt.arb`. El diseño todavía tiene copy con
voseo y un botón de compartir: el copy se pasa a tuteo y compartir no existe
(FR-28 descartado).

## F11.1 — Package: datos

### F11.1.T1 — API y repositorio de entrevistas en la app

- `apps/mobile/lib/core/api/models.dart`: modelos `InterviewQuota`,
  `InterviewSummary`, `InterviewDetail` (con `prepStep`, ficha de empresa,
  `competencies` por nombre, `questionCount`, `estimatedMin`),
  `InterviewFeedback`, `StudyCycle`, `StudyCycleSession`,
  `InterviewSessionStart`, con `fromJson` según I2.
- `FluentApi` (abstracta), `HttpFluentApi` (Dio) y `FakeFluentApi`: un método
  por cada ruta de I2, mapeando `422 OFFER_UNREADABLE`, `429
  INTERVIEWS_DAILY_CAP` y `409 TOO_SHORT` a excepciones tipadas.
- `apps/mobile/lib/features/interviews/data/interviews_repository.dart` y
  providers Riverpod (`interviewQuotaProvider`, `interviewsProvider`,
  `interviewProvider(id)` con refresco cada 3 s mientras `status ==
  preparing`).

Done when: tests de `HttpFluentApi` con un adaptador Dio falso cubren el
parseo de cada modelo y las tres excepciones; `FakeFluentApi` permite simular
una preparación que avanza de `reading` a `ready`; `flutter analyze` y
`flutter test` pasan.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Capa de datos con contrato fijo.
- **Dependencies**: F10.1.T2
- **Files**:
  - `apps/mobile/lib/core/api/models.dart`
  - `apps/mobile/lib/core/api/fluent_api.dart`
  - `apps/mobile/lib/core/api/http_fluent_api.dart`
  - `apps/mobile/lib/core/api/fake_api.dart`
  - `apps/mobile/lib/core/providers.dart`
  - `apps/mobile/lib/features/interviews/data/`
  - `apps/mobile/test/core/api/`

## F11.2 — Package: pantallas

### F11.2.T1 — Entrada: pegar oferta, URL no legible y estados

Pantalla `/interviews/new` (IE-01 y estados IE-01a vacío, 01b carga, 01c
servicio caído, 01d tope alcanzado, IE-02 URL no legible):
- campo grande para texto o enlace, botón Pegar, contador de caracteres,
  selector Técnica / Mixta, CTA "Preparar entrevista";
- cuota "Te quedan N de M entrevistas hoy" y aviso "Gratis por ahora. En el
  futuro esta función podría ser parte del plan Pro." (FR-21, FR-33);
- el texto se guarda como borrador local (SharedPreferences) y se restaura al
  volver o tras un error (FR-22);
- `OFFER_UNREADABLE` muestra el panel de IE-02 sin tono de error, con "Pegar
  el texto de la oferta" y "Abrir en LinkedIn";
- tope alcanzado deshabilita el CTA (IE-01d).

Agregar las rutas `/interviews` y `/interviews/new` en `router.dart` y una
tarjeta "Simula tu entrevista" en la pestaña Practicar
(`new_session_screen.dart`). Al crear, navegar a `/interviews/:id`.

Done when: widget tests cubren el borrador restaurado, el estado de tope, el
panel de LinkedIn y la navegación tras crear (con `FakeFluentApi`).

- **Model**: claude/claude-sonnet-5
- **Estimate**: 5h
- **Reason**: UI con varios estados siguiendo el diseño.
- **Dependencies**: F11.1.T1
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/entry/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/features/session/presentation/new_session_screen.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/entry/`

### F11.2.T2 — Preparando y resumen del plan

Pantalla `/interviews/:id` según el estado de la entrevista:
- `preparing`: IE-03 con los tres pasos (Leyendo la oferta, Investigando la
  empresa, Armando preguntas) según `prepStep`, "Suele tardar menos de un
  minuto" y "Puedes salir: te mandamos una notificación";
- poca información de la empresa: IE-03a ("Poca info");
- `prep_failed`: IE-03b con Reintentar (`POST /interviews/:id/retry`);
- `ready`: IE-04, resumen del plan: ficha de empresa (omitir campos vacíos),
  rol, área, seniority, tipo, "8 preguntas · ~10 min", competencias como chips,
  aviso de gratis, CTA "Empezar" (por ahora navega a
  `/interviews/:id/session`, que implementa F12.4) y "Reintentar".

Done when: widget tests recorren `reading → researching → designing → ready`
con `FakeFluentApi`, muestran IE-03b ante `prep_failed` y verifican que el
resumen no muestra preguntas.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: UI de estados con polling simple.
- **Dependencies**: F11.2.T1
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/prep/`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/prep/`

### F11.2.T3 — Historial de entrevistas y rutas de push

- Pantalla `/interviews` (IE-09): lista agrupada por mes con empresa, rol,
  tipo, fecha y estado (Preparando…, Sin terminar, Parecer listo, Ciclo n de 5,
  Re-entrevista hecha), botón de nueva entrevista; cada fila navega a la
  pantalla que corresponde a su estado. Acceso desde IE-01 (ícono de
  historial).
- `apps/mobile/lib/core/push/push_service.dart`: reemplazar la lista blanca
  exacta de rutas por una que además acepte `/interviews/<id>`,
  `/interviews/<id>/feedback` y `/interviews/<id>/cycle` (ids UUID), sin
  aceptar rutas arbitrarias.

Done when: widget test del historial con 5 entrevistas en distintos estados y
unit test de la lista blanca (acepta las tres rutas nuevas, rechaza
`/interviews/../settings` y `/admin`).

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: Lista y validación de rutas; nivel estándar.
- **Dependencies**: F11.2.T2
- **Files**:
  - `apps/mobile/lib/features/interviews/presentation/history/`
  - `apps/mobile/lib/core/push/push_service.dart`
  - `apps/mobile/lib/app/router.dart`
  - `apps/mobile/lib/l10n/app_es.arb`
  - `apps/mobile/lib/l10n/app_pt.arb`
  - `apps/mobile/test/features/interviews/history/`
  - `apps/mobile/test/core/push/`
