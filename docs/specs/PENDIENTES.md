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
