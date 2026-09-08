# Runbook de despliegue en Coolify

Guía operativa para crear y operar los recursos de Fluent en Coolify (VPS Contabo). El operador la ejecuta a mano en la UI de Coolify — **esta tarea (PR-08/T6) no crea los recursos**, solo documenta los pasos exactos para hacerlo. Referencia: `docs/specs/SPEC-08-infraestructura.md` §1, §3, §4.

Piezas a crear, en orden: proyecto → recurso Redis → aplicación `fluent-api` → aplicación `fluent-worker` → verificación.

---

## 0. Prerrequisitos

- Acceso a la UI de Coolify del VPS, con permisos para crear proyectos/recursos.
- El repo `fluent` en GitHub conectado a Coolify (fuente Git privada) — si Coolify todavía no tiene acceso a `https://github.com/hectorcanaimero/fluent`, añadir la integración de GitHub (App o token) desde **Settings → Sources** antes de continuar.
- Este PR (`feat/infra`) fusionado a `main`, o al menos el `Dockerfile` de `apps/api` disponible en la rama que se vaya a desplegar — Coolify construye desde `main` (SPEC-08 §4).
- Valores reales de las variables de entorno listadas en SPEC-08 §2, a mano y en un gestor de secretos temporal (no en texto plano en ningún sitio del repo ni de este runbook):
  - `INSFORGE_URL` = `https://c4jzbm8x.us-east.insforge.app` (ver SPEC-08 §6, ya es público, no es secreto).
  - `INSFORGE_API_KEY` — sacar de `apps/api/.insforge/project.json` (nunca commiteado) o con `npx -y @insforge/cli secrets get ANON_KEY`/equivalente admin key. Es secreto.
  - `INSFORGE_ANON_KEY` — `npx -y @insforge/cli secrets get ANON_KEY` (ver `docs/runbooks/insforge.md`).
  - `CREDENTIALS_MASTER_KEY` — generar con `openssl rand -base64 32` (ver `docs/runbooks/insforge.md` §4). Es secreto, se genera una vez y no se pierde.
  - `OPENROUTER_OAUTH_CALLBACK` — deep link de la app móvil, p. ej. `fluent://oauth/openrouter` (SPEC-08 §2). No es secreto.
  - `FALLBACK_MODELS` — JSON de la cadena de fallback de modelos gratuitos (SPEC-03 §2; puede no estar definida todavía si PR-03 no fusionó — usar `[]` como placeholder temporal y anotarlo, nunca dejar la variable vacía porque `apps/api/src/config/env.ts` la valida como string no vacío obligatorio).
  - `OWNER_USER_ID` — UUID del usuario operador en InsForge (se conoce tras crear la cuenta del operador con PR-02/auth fusionado; hasta entonces, placeholder y anotarlo).
  - `PROMPT_VERSION` = `1` (SPEC-08 §2). No es secreto.
  - `LOG_LEVEL` = `info` en producción (SPEC-08 §2, `apps/api/src/config/env.ts` acepta `fatal|error|warn|info|debug|trace|silent`). No es secreto.
  - `REDIS_URL` — se completa en el paso 2 (Coolify la genera al crear el recurso Redis).
  - `NODE_ENV` = `production`.
  - `PORT` = `3000`.
- Ver `apps/api/.env.example` para la lista completa con comentarios (sin valores reales, es la referencia canónica de qué variables existen).

**No sigas** si falta alguna variable obligatoria: `apps/api/src/config/env.ts` valida con zod al arrancar (`ConfigModule.forRoot({ validate: validateEnv })`) y la API/worker no arrancan si falta cualquiera de las obligatorias (todas menos `CREDENTIALS_MASTER_KEY_PREVIOUS`, que solo se usa durante rotación — ver `docs/runbooks/insforge.md` §4).

---

## 1. Crear el proyecto `fluent`

1. En la UI de Coolify: **Projects → + New Project**.
2. Nombre: `fluent`.
3. Dentro del proyecto, crear el entorno `production` (Coolify suele crear un entorno `production` por defecto al crear el proyecto; si no, **+ New Environment** → nombre `production`).

---

## 2. Crear el recurso Redis (`fluent-redis`)

1. Dentro del proyecto `fluent`, entorno `production`: **+ New Resource → Databases → Redis**.
2. Nombre del recurso: `fluent-redis`.
3. Versión: Redis 7 (SPEC-08 §1: "recurso Redis 7").
4. **Sin exposición pública** (SPEC-08 §1): NO actives "Make it publicly available" / no mapees el puerto 6379 al host. Redis debe quedar accesible solo por la red interna de Coolify (Docker network del proyecto).
5. Deploy del recurso Redis (botón **Deploy** de ese recurso). Espera a que el estado sea `Running`.
6. Copia la URL de conexión interna que Coolify genera para este recurso (normalmente algo como `redis://fluent-redis:6379`, usando el nombre del servicio dentro de la red Docker del proyecto — Coolify la muestra en la pestaña del recurso, sección "Connection" o similar). Esta es la variable `REDIS_URL` que usarán `fluent-api` y `fluent-worker` (SPEC-08 §2, ejemplo: `redis://fluent-redis:6379`).

---

## 3. Crear la aplicación `fluent-api`

1. Dentro del proyecto `fluent`, entorno `production`: **+ New Resource → Application → (fuente Git ya conectada) → seleccionar el repo `fluent`**.
2. Nombre de la aplicación: `fluent-api`.
3. **Fuente**: GitHub, repo privado del operador (`hectorcanaimero/fluent`), rama `main` (SPEC-08 §4: "rama `main`").
4. **Build pack**: `Dockerfile`.
5. **Contexto de build (Base Directory / Build Context)**: `apps/api` (SPEC-08 §4: "contexto `apps/api`"). Si Coolify separa "Base Directory" (desde dónde copia archivos) de "Dockerfile Location" (ruta del Dockerfile), ambos deben apuntar dentro de `apps/api` — es decir, el Dockerfile a usar es `apps/api/Dockerfile` y el contexto de build es el directorio `apps/api` (no la raíz del monorepo; ver el comentario al inicio de `apps/api/Dockerfile` sobre por qué el build no tiene acceso al lockfile raíz del monorepo — es intencional, documentado en `docs/specs/pendientes/PR-08.md`, T4).
6. **Puerto**: `3000` (SPEC-08 §4 y `PORT` del entorno).
7. **Dominio**: usar el dominio sslip.io de desarrollo de SPEC-08 §1: `fluent-api.<IP-del-VPS>.sslip.io` (sustituir `<IP-del-VPS>` por la IP pública real del VPS Contabo). Coolify gestiona el certificado Let's Encrypt automáticamente vía Traefik al asignar el dominio — activar "Generate SSL Certificate" / HTTPS si no es automático.
8. **Healthcheck**: la imagen ya trae un `HEALTHCHECK` de Docker (`apps/api/Dockerfile`, `wget --spider http://localhost:${PORT:-3000}/v1/health`). En Coolify, además, configura el healthcheck a nivel de aplicación (pestaña **Health Check** de la app) apuntando a la misma ruta `/v1/health`, puerto `3000`, método `GET`, para que Coolify (y Sentinel, SPEC-08 §7) puedan marcar la app como no saludable si `/v1/health` deja de responder — nota: `/v1/health` siempre responde `200`, incluso si `redis`/`insforge` internos están caídos (ver `docs/specs/pendientes/PR-08.md`, T3); el healthcheck de Coolify solo detecta que el **proceso HTTP** responde, no degradaciones parciales. Para esas, revisar el cuerpo de la respuesta manualmente o en el panel de métricas (SPEC-08 §7, fuera del alcance de T6).
9. **Variables de entorno**: cargar todas las de la sección 0 de este runbook (más `REDIS_URL` del paso 2) en la pestaña **Environment Variables** de la aplicación. Marca como "secretas" (ocultas en la UI/logs) al menos: `INSFORGE_API_KEY`, `INSFORGE_ANON_KEY`, `CREDENTIALS_MASTER_KEY`, `CREDENTIALS_MASTER_KEY_PREVIOUS` (si aplica). Usa el checklist de la sección 5 antes de desplegar.
10. **Límite de memoria**: 1 GB (SPEC-08 §3: "Límite de memoria en Coolify: 1 GB para la API"). Configúralo en la pestaña de recursos/límites de la aplicación (**Resource Limits**, campo de memoria máxima).
11. **Auto-deploy**: activa el webhook de auto-deploy por push a `main` (SPEC-08 §4: "Auto-deploy por webhook de GitHub en push a `main`"). Coolify genera la URL del webhook y, si la integración de GitHub está bien conectada (paso 0), configura el webhook automáticamente en el repo; si no, copiar la URL del webhook desde Coolify y añadirla a mano en GitHub (**Settings → Webhooks** del repo).
12. Deploy inicial: botón **Deploy**. Sigue el log de build en la propia UI de Coolify hasta que el estado sea `Running` y el healthcheck esté en verde.

---

## 4. Crear la aplicación `fluent-worker`

1. Dentro del proyecto `fluent`, entorno `production`: **+ New Resource → Application**, misma fuente que `fluent-api` (mismo repo, misma rama `main`, mismo build pack `Dockerfile`, mismo contexto `apps/api`) — SPEC-08 §4: "misma fuente, comando de arranque sobrescrito".
2. Nombre: `fluent-worker`.
3. **Proceso**: añade la variable de entorno `FLUENT_PROCESS=worker`. El `CMD` de la imagen arranca `node dist/worker.js` cuando esa variable vale `worker` y la API en cualquier otro caso. Ver `apps/api/Dockerfile` y `apps/api/src/worker.ts`.
4. **Sin dominio** (SPEC-08 §4: "sin dominio"): no asignes ningún dominio/puerto público a esta aplicación — el worker no expone HTTP (no llama a `app.listen()`, solo `app.init()`, ver `apps/api/src/worker.ts`).
5. **Sin healthcheck HTTP**: como no hay endpoint HTTP, desactiva cualquier healthcheck basado en URL para esta app (o dejar el `HEALTHCHECK` de Docker de la imagen desactivado/sin usar para este servicio si Coolify lo permite; si Coolify exige un healthcheck, usar uno de tipo "proceso corriendo" en vez de HTTP, si esa opción existe, o documentar que se deja sin healthcheck en este PR).
6. **Variables de entorno**: las mismas que `fluent-api` (mismo `REDIS_URL`, mismas credenciales de InsForge, mismo `CREDENTIALS_MASTER_KEY`, etc.) — el worker valida el mismo schema `Env` (zod) que la API (`apps/api/src/worker.module.ts` importa `ConfigModule` con el mismo `validateEnv`).
7. **Límite de memoria**: 768 MB (SPEC-08 §3: "768 MB para el worker").
8. **Auto-deploy**: igual que `fluent-api`, webhook por push a `main`.
9. Deploy inicial: botón **Deploy**. Como no hay healthcheck HTTP, verificar que arrancó bien revisando los logs (ver sección 6): debe verse el log de arranque de Nest sin errores, sin el `ZodError` de variables faltantes.

---

## 5. Checklist de variables de entorno (API y worker)

Antes de cada deploy (inicial o tras rotar algo), confirmar en la UI de Coolify que ambas aplicaciones (`fluent-api` y `fluent-worker`) tienen **todas** estas variables, con el mismo valor entre ambas salvo que se indique lo contrario (fuente: SPEC-08 §2 y `apps/api/.env.example`):

| Variable | ¿Secreta? | ¿Igual en API y worker? |
|---|---|---|
| `NODE_ENV` | No | Sí (`production`) |
| `PORT` | No | Solo la usa la API (el worker no escucha HTTP; se puede dejar igualmente en `3000` sin efecto) |
| `INSFORGE_URL` | No | Sí |
| `INSFORGE_API_KEY` | **Sí** | Sí |
| `INSFORGE_ANON_KEY` | **Sí** | Sí |
| `REDIS_URL` | No (pero es de red interna) | Sí |
| `CREDENTIALS_MASTER_KEY` | **Sí** | Sí |
| `CREDENTIALS_MASTER_KEY_PREVIOUS` | **Sí** (solo durante rotación, ver `docs/runbooks/insforge.md` §4) | Sí, o ausente en ambas |
| `OPENROUTER_OAUTH_CALLBACK` | No | Sí |
| `FALLBACK_MODELS` | No (pero no puede estar vacía) | Sí |
| `PROMPT_VERSION` | No | Sí |
| `OWNER_USER_ID` | No (pero es un identificador, no lo publiques innecesariamente) | Sí |
| `LOG_LEVEL` | No | Sí (`info` en producción) |

Si falta cualquier variable obligatoria (todas salvo `CREDENTIALS_MASTER_KEY_PREVIOUS`), el proceso falla al arrancar con un `ZodError` claro en los logs (ver `apps/api/src/config/env.ts`) — no es un fallo silencioso.

---

## 6. Redeploy y logs

**Redeploy manual** (cuando el auto-deploy por webhook no aplica, p. ej. para relanzar un deploy que falló en el `git clone` por la inestabilidad de red del VPS hacia GitHub, SPEC-08 §4 y §9 de SPEC-08 sobre reintentos):

1. En la UI de Coolify, entrar a la aplicación (`fluent-api` o `fluent-worker`).
2. Botón **Redeploy** (o **Deploy** si no hay un deploy previo en curso).
3. Seguir el log de build en tiempo real desde la misma pantalla.

**Ver logs en vivo**:

1. En la aplicación, pestaña **Logs** (a veces llamada "Application Logs" o similar, distinta de "Deployment Logs"/build logs).
2. Como la API y el worker usan `pino` para logs estructurados en JSON (SPEC-08 §7, `nestjs-pino` configurado en `apps/api/src/app.module.ts`/`worker.module.ts`), cada línea de log en Coolify es un objeto JSON (nivel, timestamp, mensaje, contexto). Coolify no pretty-imprime JSON por defecto — si hace falta legibilidad, copiar el log y pasarlo por `jq` o un formateador de JSON localmente.
3. Nivel de log controlado por la variable `LOG_LEVEL` (sección 5) — bajar a `debug` temporalmente (redeploy tras cambiar la variable) si hace falta más detalle para diagnosticar un problema, y volver a `info` después.

**Ver logs de un deploy que falló en el clone de GitHub** (SPEC-08 §4: "Como la ruta del VPS a GitHub falla a ratos, Coolify reintenta el clone; si un deploy falla en clone, se relanza a mano"):

1. Pestaña **Deployments** de la aplicación → abrir el deploy fallido → revisar si el error es de `git clone`/timeout de red (no de build de Docker).
2. Si es de red: simplemente **Redeploy** de nuevo (paso anterior). El build en sí no depende de GitHub una vez que el clone tuvo éxito (SPEC-08 §4).
3. Si el error persiste más de 2-3 reintentos, revisar conectividad del VPS hacia GitHub manualmente (`git ls-remote https://github.com/hectorcanaimero/fluent` desde una shell del VPS) antes de seguir reintentando desde Coolify.

---

## 7. Verificación final (criterio de aceptación de T6)

Una vez desplegada `fluent-api` con dominio y healthcheck en verde:

```bash
curl https://fluent-api.<IP-del-VPS>.sslip.io/v1/health
```

Debe devolver `200` con un cuerpo JSON con `"ok": true` (y `redis.ok`/`insforge.ok` en `true` si `REDIS_URL` e `INSFORGE_URL`/`INSFORGE_API_KEY` están bien configuradas — ver `apps/api/src/health/health.service.ts`). Si `ok` es `false` pero el `curl` responde `200`, revisar el detalle `redis.ok`/`insforge.ok` del cuerpo de la respuesta para saber cuál de los dos falló, y los logs (sección 6) para el motivo.

---

## Notas

- Esta tarea (T6) **no se ejecutó** en esta sesión — no se creó ningún recurso real en Coolify. Este documento son los pasos exactos para que el operador los siga en la UI cuando quiera desplegar.
- Si en el futuro Coolify expone una API/CLI accesible para un agente, se puede reemplazar este runbook manual por un script, pero hoy (2026-09-08) se documenta como procedimiento de UI porque es lo que pide el alcance de T6 ("Si la API de Coolify no está disponible para el agente, dejar el runbook con los pasos exactos para que el operador lo haga en la UI").
- Dominio propio: cuando el operador tenga un dominio propio, SPEC-08 §1 indica cambiarlo en Coolify (pestaña de dominios de `fluent-api`) y en la variable `API_URL` de la app móvil (fuera del alcance de este runbook, es de PR-06).
