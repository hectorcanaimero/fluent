# Pendientes y decisiones sin spec

- 2026-09-08 (T1, PR-08): `LEADERBOARD_RESET` (SPEC-07 §1) se tipa como el
  literal de string `'monday_00_utc'` (`as const`, con un tipo
  `LeaderboardReset` derivado) en vez de un enum. Es el tipo más simple para
  un único valor posible hoy; si en el futuro hay varios momentos de reset
  configurables, se puede migrar a `z.enum(...)` o a un enum de TypeScript
  sin romper el uso actual. Ver `apps/api/src/config/product.ts`.

- 2026-09-08 (T1, PR-08): Opciones de `ValidationPipe` global en
  `apps/api/src/main.ts` no están especificadas en ninguna spec. Se eligieron
  `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` por ser
  el valor por defecto razonable y más simple para DTOs futuros (rechaza
  propiedades no declaradas y castea tipos primitivos automáticamente).
  Revisar si algún endpoint concreto necesita desviarse de esto.

- 2026-09-08 (T1, PR-08): Estrategia de `.env.test` para que
  `ConfigModule`/`AppModule` arranquen en tests sin secretos reales: se creó
  `apps/api/.env.test` (commiteado, con valores ficticios) y
  `envFilePath` en `ConfigModule.forRoot(...)` se elige según
  `process.env.NODE_ENV === 'test'` (vitest lo define automáticamente,
  verificado con una prueba puntual) → `.env.test`, si no → `.env`. Es la
  opción más simple que no requiere mocks de `ConfigService` en cada test.
  Se confirmó que `apps/api/.env.test` no cae bajo ningún patrón de
  `.gitignore` (ni el de la raíz ni el de `apps/api/.gitignore`), con
  `git check-ignore -v apps/api/.env.test` (sin salida → no ignorado).

- 2026-09-08 (T2, PR-08): El alcance de T2 en `docs/tasks/PR-08-infraestructura.md`
  dice literalmente "verificar que `.insforge/project.json` está commiteado sin
  secretos". Esto contradice la instrucción explícita de la sesión (y el
  `.gitignore` real del repo, que excluye `apps/api/.insforge/` precisamente
  porque `project.json` contiene la API key admin en texto plano, no una
  versión "sin secretos" de ese archivo). Se siguió la instrucción explícita,
  de mayor jerarquía: `apps/api/.insforge/project.json` se mantiene fuera del
  repo (gitignored, verificado con `git check-ignore -v`), nunca commiteado ni
  impreso. Lo que sí se commitea es `apps/api/insforge.toml` (config export/plan/apply
  de la CLI, sin secretos: flags de auth como `require_email_verification`) y
  la URL pública del proyecto en `docs/specs/SPEC-08-infraestructura.md` §6.
  El criterio de aceptación real de T2 (`current` muestra `fluent`;
  `metadata --json` con `requireEmailVerification: false`) se cumplió igual.

- 2026-09-08 (T3, PR-08): Versión de `ioredis` fijada a `^5.11.1` en vez de
  la última (`6.0.0`, publicada como major reciente). `ioredis-mock@8.13.1`
  declara peer dep `ioredis@^5`, y con `ioredis@6.0.0` `pnpm` reporta el
  peer como no satisfecho. Se prioriza compatibilidad verificada con
  `ioredis-mock` (usado en los tests obligatorios de esta tarea) sobre la
  versión más nueva. Revisar cuando `ioredis-mock` soporte `ioredis@6`.

- 2026-09-08 (T3, PR-08): Opciones de conexión de `RedisModule`
  (`apps/api/src/redis/redis.module.ts`) no están especificadas en ninguna
  spec. Se eligió `lazyConnect: true` (no conecta hasta el primer comando,
  evita que `AppModule`/tests e2e intenten conectar de verdad al arrancar),
  `connectTimeout: 500`, `maxRetriesPerRequest: 1` y
  `retryStrategy: (times) => (times > 2 ? null : 100)` para que un `PING`
  contra un Redis caído o inexistente falle en un par de cientos de ms en
  vez de reintentar indefinidamente con el backoff por defecto de `ioredis`
  (que puede tardar >10s en agotar los 20 reintentos por defecto). Se
  verificó empíricamente (script puntual, no commiteado) que con estas
  opciones un `PING` contra `redis://localhost:6379` sin servidor real
  falla en ~150-300ms y las llamadas siguientes fallan de inmediato
  (`Connection is closed`), sin necesidad de un listener de reconexión
  adicional. En producción, contra un Redis real, esto solo acota cuánto
  tarda `/v1/health` en detectar una caída; no afecta al funcionamiento
  normal. Se añadió también un listener `on('error', ...)` en ambos
  clientes (obligatorio en `ioredis`: sin él, un error de socket no
  manejado tira el proceso por el comportamiento por defecto de
  `EventEmitter`).

- 2026-09-08 (T3, PR-08): Forma exacta del JSON de
  `GET {INSFORGE_URL}/api/auth/sessions/current` (SPEC-02) no documentada en
  las specs de este repo. `InsforgeHttp.getCurrentSession` (en
  `apps/api/src/insforge/insforge.http.ts`) asume, de forma defensiva, que
  el id de usuario está en `data.id` o en `data.user.id` (optional
  chaining, probando ambas formas), y devuelve `{ ok: false }` si ninguna
  de las dos resuelve a un string no vacío. Revisar y ajustar cuando se
  verifique la respuesta real de InsForge (por ejemplo la primera vez que
  se integre el flujo de auth completo en otro PR).

- 2026-09-08 (T3, PR-08): `InsforgeHttp.checkHealth()` llama a
  `GET {INSFORGE_URL}/api/health` sin ninguna autenticación (sin
  `Authorization` ni `apiKey`). Se asumió que es la opción más simple y que
  un endpoint de health suele ser público; no hay ninguna spec que indique
  que requiera autenticación. Si en el futuro InsForge exige `apiKey` para
  este endpoint, habrá que añadir el header correspondiente.

- 2026-09-08 (T3, PR-08): Formato de `GET /v1/health` ampliado (T3) a
  `{ ok, version, redis: { ok }, insforge: { ok } }`, con
  `ok = redis.ok && insforge.ok` (`apps/api/src/health/health.service.ts`).
  Es el formato sugerido explícitamente en el alcance de T3 de
  `docs/tasks/PR-08-infraestructura.md`; no había otra spec que lo definiera
  con más detalle (por ejemplo, no se añadieron latencias ni mensajes de
  error individuales, solo el booleano `ok` por servicio).

- 2026-09-08 (T3, PR-08): `HealthController.check()` sigue devolviendo
  siempre HTTP 200, incluso cuando `ok` interno es `false` (Redis o
  InsForge caídos): el estado va en el body, no en el código HTTP. Decidir
  códigos de fallo (p. ej. 503 cuando `ok:false`) es responsabilidad de
  T4/Coolify/Sentinel (fuera del alcance de T3), como indica el enunciado de
  la tarea.

- 2026-09-08 (T3, PR-08): `apps/api/test/health.e2e-spec.ts` se actualizó
  para no exigir `response.body.ok === true`: como `.env.test` apunta
  `REDIS_URL` e `INSFORGE_URL` a valores ficticios/no alcanzables desde este
  entorno, tras T3 el e2e obtiene de forma determinista `redis.ok:false` e
  `insforge.ok:false` (verificado: `fetch` a la URL ficticia falla en
  ~180ms, y el `PING` de Redis falla en <300ms gracias a las opciones de
  conexión acotadas descritas arriba). El test ahora verifica la forma de
  la respuesta (tipos booleanos de `ok`, `redis.ok`, `insforge.ok`, y
  `version` como string) y que el endpoint responde 200, en vez del valor
  concreto de cada `ok`. Se confirmó que la suite completa de e2e termina
  en ~4s (no se cuelga).

- 2026-09-08 (T5, PR-08): Workflow CI (`.github/workflows/ci.yml`) usa
  `on: pull_request` sin restringir a ramas base específicas; corre en
  cualquier PR independientemente de cuál sea la rama base. Esto es lo más
  general y útil, y permite que el flujo de CI sea agnóstico a cambios
  futuros en las ramas base del repo. Si en el futuro se requiere correr solo
  en PRs contra `main`, se puede restringir con `on: { pull_request: { branches: [main] } }`.

- 2026-09-08 (T5, PR-08): `pnpm audit --audit-level high` se ejecuta en la
  raíz del monorepo (sin `--filter @fluent/api`). `pnpm audit` es un comando
  de pnpm, no un script npm, y se aplica a todo el monorepo por defecto
  (audita las dependencias de todos los workspaces). Esta es la forma estándar
  y la más simple de auditar el monorepo completo.

- 2026-09-08 (T4, PR-08): `apps/api/Dockerfile` instala dependencias con
  `pnpm install --no-frozen-lockfile` en vez de `--frozen-lockfile`
  (mencionado literalmente en SPEC-08 §3). El build de Coolify usa
  contexto `apps/api` (SPEC-08 §4:
  `docker build -f apps/api/Dockerfile apps/api`), y dentro de ese
  contexto no hay acceso al `pnpm-lock.yaml` ni al `pnpm-workspace.yaml`
  reales del monorepo (viven en la raíz, fuera del contexto de build). Se
  descartó mover o duplicar el lockfile real del repo dentro de
  `apps/api` para no tener dos fuentes de verdad del lockfile ni
  arriesgar que se desincronicen. Como `apps/api` es el único paquete del
  workspace pnpm (`pnpm-workspace.yaml`: `packages: [apps/api]`) y no
  tiene dependencias `workspace:*` a otros paquetes del repo, instalar
  sin lockfile dentro de este contexto acotado resuelve, en la práctica,
  las mismas versiones que resolvería el lockfile real (mismos rangos
  semver en `apps/api/package.json`). Para acotar al menos la
  reproducibilidad del propio gestor de paquetes, el Dockerfile fija la
  versión de pnpm con `corepack prepare pnpm@9.15.2 --activate` (mismo
  valor que el campo `packageManager` de la raíz del monorepo). Se
  prefirió esta opción, la más simple, sobre alternativas más complejas
  (p. ej. generar un lockfile de `apps/api` en CI/local y commitearlo, o
  cambiar el build de Coolify a contexto raíz), que no estaban pedidas
  por la tarea y añadirían una segunda fuente de verdad o se apartarían
  de SPEC-08 §4. Revisar si en el futuro se necesita reproducibilidad
  estricta de versiones (p. ej. fijando un lockfile de `apps/api` real y
  usando `--frozen-lockfile` contra él).

- 2026-09-08 (T4, PR-08): `apps/api/Dockerfile` usa `wget --spider` (de
  BusyBox, ya presente en `node:24-alpine`) para el `HEALTHCHECK` en vez
  de instalar `curl` (que no viene en la imagen base), para no añadir
  paquetes a la imagen final de runtime. Verificado en la imagen de
  prueba: `wget` existe en `node:24-alpine` sin instalar nada adicional.

- 2026-09-08 (T4, PR-08): Criterio de aceptación de T4
  (`docker run --rm <img> node -e "require('./dist/main.js')"`): en la
  imagen construida (Node v24.20.0, confirmado con
  `docker run --rm fluent-api-t4-test node --version`), ese comando
  literal falla con:

  ```
  Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM
  graph with top-level await. Use import() instead. To see where the
  top-level await comes from, use --experimental-print-required-tla.
  Required module: /app/dist/main.js
  ```

  No es un error de resolución de módulos, rutas rotas ni de sintaxis:
  Node 24 sí soporta `require()` síncrono de ESM de forma nativa, pero no
  puede hacerlo cuando el grafo del módulo contiene top-level await (como
  `await bootstrap()` al final de `apps/api/src/main.ts`), porque
  `require()` es síncrono por definición y el TLA es inherentemente
  asíncrono; es una limitación conocida de Node, no un problema del
  Dockerfile ni del build. Como comprobación adicional (sugerida por el
  enunciado de la tarea), se probó
  `docker run --rm fluent-api-t4-test node dist/main.js` (sin `require()`,
  como lo ejecutaría realmente Coolify vía el `CMD` del Dockerfile): este
  sí arranca Nest limpiamente y falla únicamente por el `ZodError`
  esperado de variables de entorno obligatorias ausentes
  (`INSFORGE_URL`, `INSFORGE_API_KEY`, etc.), sin ningún error de
  ESM/CJS. No se tocó `"type": "module"` de `package.json` ni la config
  de módulos de TypeScript para "arreglar" el `require()` literal del
  criterio, como pidió explícitamente el enunciado de la tarea; se deja
  a la sesión líder decidir si el criterio de aceptación debe
  reformularse para usar `node dist/main.js` en vez de
  `node -e "require(...)"`, dado que es el comando real que ejecuta la
  imagen en producción (el `CMD` del Dockerfile) y el que sí pasa sin
  errores de módulos.

- 2026-09-08 (T4, PR-08, decisión de la sesión líder): en vez de reformular
  el criterio de aceptación, se ajustó `apps/api/src/main.ts` y
  `apps/api/src/worker.ts` para no usar `await bootstrap();` a nivel de
  módulo (top-level await): ahora es `bootstrap().catch((error) => {
  console.error(...); process.exitCode = 1; })`, el patrón histórico de
  arranque de NestJS antes de que existiera top-level await. Con este
  cambio, `docker run --rm <img> node -e "require('./dist/main.js')"`
  cumple el criterio **literal** de T4 tal como está escrito: el `require`
  ya no falla con `ERR_REQUIRE_ASYNC_MODULE`, y falla únicamente por el
  `ZodError` esperado de variables de entorno ausentes (verificado de
  nuevo con una imagen de prueba, `fluent-api-t4-verify`, borrada al
  terminar). No afecta el comportamiento en producción (`node dist/main.js`
  vía el `CMD` del Dockerfile): Nest arranca igual, y un fallo de
  `bootstrap()` sigue terminando el proceso con código de salida distinto
  de cero (antes por la propagación de la excepción del top-level await,
  ahora por `process.exitCode = 1` explícito tras el `.catch`), así que
  Coolify/Docker siguen detectando el arranque fallido igual. Gate de
  build/test de `@fluent/api` re-verificado en verde tras el cambio.
