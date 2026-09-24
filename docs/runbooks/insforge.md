# Runbook de InsForge y Backups

Guía operativa para administrar el proyecto InsForge de Fluent y sus backups. El operador ejecuta estos procedimientos a mano desde el VPS según sea necesario.

**Proyecto InsForge:**
- ID: `cca888af-daa6-4046-9828-f987e975dad1`
- App Key: `c4jzbm8x`
- Región: `us-east`
- URL: `https://c4jzbm8x.us-east.insforge.app`
- Contexto: enlazado en `apps/api` con `.insforge/project.json` (nunca se commitea; contiene la API key admin)

**Supuestos operativos:**
- El VPS tiene configurado el contexto de autenticación de la CLI de InsForge (token guardado en `~/.insforge` tras ejecutar `login` al menos una vez en la sesión del operador).
- Cron y scripts heredan ese contexto si se ejecutan con el mismo usuario que hizo `login`.
- Todos los comandos se ejecutan desde el directorio del proyecto o desde `apps/api/` donde esté el enlace del proyecto.

---

## 1. Aplicar migraciones

Las migraciones definen el esquema Postgres y las políticas RLS. Se crean localmente, se prueban en una rama de InsForge, y luego se aplican a producción.

**Migraciones planeadas (SPEC-01 §6):**
1. `0001_extensions_y_grupos.sql` — `groups`, `invitations`, `profiles`, vista `group_members`, trigger de `updated_at`.
2. `0002_proveedores.sql` — `provider_credentials`, `model_preferences`.
3. `0003_sesiones.sql` — `sessions`, `turns`, `corrections`, `xp_events`, `llm_calls`, función `close_session`.
4. `0004_memoria.sql` — `facts`, `coaching_briefs`, `coaching_brief_history`, función `pick_callback_fact`.
5. `0005_contenido_y_social.sql` — `news_items`, `weekly_summaries`, funciones `weekly_leaderboard` y `apply_streak_grace`.

### 1.1 Crear una migración

Desde `apps/api/`:

```bash
npx -y @insforge/cli db migrations new <nombre>
```

Ejemplo:
```bash
npx -y @insforge/cli db migrations new extensions-y-grupos
```

Esto genera un archivo con timestamp en `apps/api/migrations/` (p. ej., `20260908150532_extensions-y-grupos.sql`). El archivo está vacío; edítalo con el SQL de tu cambio.

**Reglas del nombre:**
- Solo letras minúsculas, números y guiones.
- Sin espacios, underscores, mayúsculas.

**Reglas del SQL:**
- NO incluyas `BEGIN`, `COMMIT`, `ROLLBACK` — la CLI lo wrappea en una transacción.
- Usa schema `public` para tablas y políticas de la app.
- Referencia objetos built-in como `auth.users(id)` sin modificarlos.
- Incluye políticas RLS y GRANTs en la misma migración donde creas la tabla.

Ejemplo de estructura (`apps/api/migrations/20260908150532_extensions-y-grupos.sql`):

```sql
-- Crear tabla groups
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  group_streak INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla profiles con FK a groups
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id),
  display_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A2','B1','B2')),
  -- ... más columnas ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crear tabla invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  code TEXT PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id),
  -- ... más columnas ...
);

-- Crear vista group_members
CREATE OR REPLACE VIEW public.group_members AS
SELECT u.user_id, p.display_name, p.level, p.xp, p.streak, p.last_session_day, p.group_id
FROM public.profiles p
WHERE p.group_id = (SELECT group_id FROM public.profiles WHERE user_id = auth.uid())
AND p.group_id IS NOT NULL;

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Políticas RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (user_id = auth.uid() OR group_id IN (SELECT group_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- GRANTs al rol authenticated
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.groups TO authenticated;
GRANT SELECT ON public.invitations TO authenticated;
GRANT SELECT ON public.group_members TO authenticated;
```

### 1.2 Flujo: rama de InsForge, prueba, fusión

**Paso 1: Crear una rama de InsForge para probar la migración**

```bash
npx -y @insforge/cli branch create <rama-para-pr> --mode schema-only
```

Ejemplo (si estás trabajando en PR-02):
```bash
npx -y @insforge/cli branch create pr-02-migraciones --mode schema-only
```

Esto crea una rama esquemática (sin copia de datos reales, solo estructura). El comando automáticamente te cambia a esa rama (update a `.insforge/project.json`). La creación tarda típicamente 2–5 minutos.

**Paso 2: Cambiar el servidor de desarrollo a la rama (opcional pero recomendado)**

Si desarrollas localmente contra la rama:
```bash
# El .insforge/project.json ya apunta a la rama tras branch create
# Re-sourcea el .env de tu servidor local:
source .env  # o la ruta a tu .env
```

El servidor local ahora usa `INSFORGE_URL` e `INSFORGE_ANON_KEY` de la rama.

**Paso 3: Aplicar la migración en la rama**

Desde `apps/api/`:
```bash
npx -y @insforge/cli db migrations up --all
```

O si quieres aplicar una específica:
```bash
npx -y @insforge/cli db migrations up 20260908150532_extensions-y-grupos.sql
```

**Paso 4: Probar en la rama**

- Verifica el esquema: `npx -y @insforge/cli db tables` o inspecciona manualmente.
- Prueba operaciones RLS: llamadas REST de la app, cambios de permisos.
- Valida que no hay errores en logs: `npx -y @insforge/cli logs postgres.logs`.

Si hay errores, corrige el SQL en el archivo local y vuelve a aplicar (una sola vez más; si falla dos veces, resuelve manualmente o descarta la rama).

**Paso 5: Fusionar la rama a producción**

Primero, vista previa:
```bash
npx -y @insforge/cli branch merge <rama-para-pr> --dry-run --save-sql /tmp/merge-preview.sql
```

Revisa `/tmp/merge-preview.sql` para asegurar que el SQL se ve bien. Busca conflictos o cambios inesperados.

Si todo bien, fusiona:
```bash
npx -y @insforge/cli branch merge <rama-para-pr>
```

El comando te pide confirmación (`Apply this merge to parent project 'fluent'? › yes`). Escribe `yes`.

**Paso 6: Limpiar la rama (opcional)**

Después de fusionar exitosamente, puedes borrar la rama para liberar recursos (cada rama consume EC2):
```bash
npx -y @insforge/cli branch delete <rama-para-pr> -y
```

**Paso 7: Volver a producción**

Si habías cambiado a la rama:
```bash
npx -y @insforge/cli branch switch --parent
source .env  # re-sourcea para que el servidor vuelva a producción
```

### 1.3 Aplicar migraciones directamente a producción (sin rama, raro)

Solo si ya probaste exhaustivamente localmente y confías en el cambio:

```bash
npx -y @insforge/cli db migrations up --all
```

Esto aplica **todos** los pending locales. Solo lo hagas si has planificado la secuencia.

**Regla importante (SPEC-08 §5):**
> Las migraciones se aplican a mano con la CLI de InsForge desde el VPS antes del deploy que las necesita, previa prueba en una rama de InsForge. Se documenta en el PR.

Significa:
1. Prueba en rama.
2. Documenta el procedimiento en el PR (cómo se creó la rama, qué se migró, qué se verificó).
3. El operador ejecuta la migración desde el VPS antes de hacer `git push` a `main` y que Coolify dispare el auto-deploy.

---

## 2. Crear y fusionar ramas de InsForge

Las ramas son entornos de prueba aislados de producción. Cada rama tiene su propia base Postgres, storage y credenciales de API.

### 2.1 Cuándo usar una rama

**Sí, crea rama si:**
- Modificas o creas políticas RLS (invisibilidad de datos es un riesgo silencioso).
- Cambias esquema destructivo: `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE` (irreversible).
- Refactors multi-tabla (>3 tablas o >1 schema).
- Cambios en auth o config (OAuth, SMTP).

**No, salta rama si:**
- Solo cambios de datos (INSERT/UPDATE de filas).
- Cambios en la app móvil o API NestJS que no tocan BD.
- Lógica de funciones de borde cubierta por tests unitarios.

### 2.2 Crear una rama

```bash
npx -y @insforge/cli branch create <nombre> [--mode full|schema-only] [--no-switch]
```

**Opciones:**
- `<nombre>`: 1–64 caracteres, letras/dígitos/guiones, comienza con letra o dígito. Recomendación: usa el nombre del PR (p. ej., `pr-02-migraciones`, `pr-05-auth`).
- `--mode full` (default): copia completa con datos. Lento para BDs grandes.
- `--mode schema-only`: solo estructura (tablas, índices, RLS sin datos de usuarios). Rápido. Perfecto para probar esquema.
- `--no-switch`: crea la rama pero NO cambia el `.insforge/project.json` a ella. Úsalo si quieres crearla pero seguir en producción.

Ejemplo:
```bash
npx -y @insforge/cli branch create pr-02-auth --mode schema-only
```

Salida:
```
✓ Branch 'pr-02-auth' created (ID: br_xxxxx).
✓ Switched to branch 'pr-02-auth'.
Provisioning… (typically 2-5 minutes)
```

### 2.3 Listar ramas

```bash
npx -y @insforge/cli branch list
```

Salida:
```
NAME            STATE     CREATED
pr-02-auth      ready     2026-09-08 15:30
pr-03-sessions  merged    2026-09-08 10:20
*main (parent)  —         (linked project)
```

El asterisco `*` marca la rama actualmente activa.

### 2.4 Cambiar entre ramas

```bash
npx -y @insforge/cli branch switch <nombre>
```

O vuelve al proyecto principal (parent):
```bash
npx -y @insforge/cli branch switch --parent
```

**Advertencia crítica:** el comando solo actualiza `.insforge/project.json`. No re-sourcea `.env` automáticamente. Si tu servidor de desarrollo lee variables de entorno (típico), ejecuta manualmente:
```bash
source .env
```

Si no lo haces, el SDK silenciosamente seguirá hablando con el proyecto anterior — es la fuente más común de "cambié de rama pero mis cambios no aparecen".

### 2.5 Fusionar una rama a producción

**Paso 1: Vista previa (siempre)**

```bash
npx -y @insforge/cli branch merge <nombre> --dry-run --save-sql /tmp/merge.sql
```

El comando genera un script SQL que muestra qué se va a aplicar. Revísalo:
```bash
cat /tmp/merge.sql
```

Busca:
- Tablas/columnas correctas.
- Políticas RLS con lógica esperada.
- Ningún DROP inesperado (las ramas no deberían dropear).

Si ves conflictos (tabla modificada en ambos lados tras la creación de la rama):
```
⚠️ MERGE BLOCKED: 1 conflict(s) detected. Resolve before applying.
[CONFLICT] table public.users
  parent_t0_hash:  <hash>
  parent_now_hash: <different>
  branch_now_hash: <different>
```

Resuelve manualmente:
1. Inspecciona las dos versiones (rama vs parent).
2. Decide cuál mantener o combina manualmente en una migración.
3. Corre `--dry-run` de nuevo para verificar que no quedan conflictos.

**Paso 2: Aplicar la fusión**

```bash
npx -y @insforge/cli branch merge <nombre>
```

Te pide confirmación:
```
? Apply this merge to parent project 'fluent'? › yes
```

Responde `yes`. El comando aplica el SQL dentro de una transacción — si falla, hace rollback automático.

Salida de éxito:
```
✓ Merged. Branch 'pr-02-auth' is now in 'merged' state.
⚠ Reminder: redeploy edge functions, website, and compute as needed.
```

**Paso 3: Redeploy de código (si necesario)**

Si creaste funciones edge, frontends o servicios en la rama, redeploy en el parent:
```bash
npx -y @insforge/cli functions deploy <slug>    # si tocaste funciones
npx -y @insforge/cli deployments deploy <dir>   # si tocaste frontends
npx -y @insforge/cli compute deploy ...         # si tocaste servicios
```

Si no haces esto y el código depende del nuevo esquema, fallarán las llamadas.

### 2.6 Resetear una rama (reutilizar el mismo slot)

Si quieres deshacer cambios en una rama y volver a T0 (estado inicial), sin crear una nueva rama (ahorra costo y nombres):

```bash
npx -y @insforge/cli branch reset <nombre>
```

Esto rewind a la snapshot inicial de la rama, cambia el estado de `merged` a `ready`, y mantiene los mismos `API_KEY` / `ANON_KEY`. Perfecta para reintentarla sin recrearla.

### 2.7 Borrar una rama

```bash
npx -y @insforge/cli branch delete <nombre> -y
```

Libera el EC2. **Irreversible** — los datos de la rama se pierden. Si estabas en esa rama, te devuelve automáticamente al parent.

---

## 3. Backups semanales

Backups automáticos en la nube de InsForge. Se crean semanalmente desde un cron del VPS y se pueden restaurar en emergencia.

### 3.1 Crear un backup manual

```bash
npx -y @insforge/cli backups create --name "fluent-weekly-$(date +%F)" --wait
```

Opciones:
- `--name <nombre>`: opcional (1–64 caracteres). Genera automáticamente si no lo especificas.
- `--wait`: bloquea hasta que el backup termine (típicamente 30–60 segundos). Sin él, retorna en queued.

Ejemplo:
```bash
npx -y @insforge/cli backups create --name "fluent-weekly-2026-09-08" --wait
```

Salida:
```
✓ Backup created: backup_xxxxx
  Name: fluent-weekly-2026-09-08
  Size: 42 MB
  Created: 2026-09-08T15:30:00Z
```

### 3.2 Backup automático semanal (cron del VPS)

En el VPS, añade una entrada a crontab del usuario operador:

```bash
crontab -e
```

Añade esta línea (ejecuta cada domingo a las 3:00 AM UTC):

```cron
0 3 * * 0 cd /root/projects/fluent && npx -y @insforge/cli backups create --name "fluent-weekly-$(date +\%F)" --wait
```

**Explicación:**
- `0 3 * * 0` — Domingo, 03:00 UTC.
- `cd /root/projects/fluent` — Cambia al repo (para que encuentre `.insforge/project.json`).
- `npx -y @insforge/cli backups create ...` — Crea el backup.
- `$(date +\%F)` — Genera nombre con fecha (escapa el `%` porque está en cron).
- `--wait` — Espera a que termine antes de salir.

**Supuesto crítico:** el usuario cron (mismo que ejecuta `crontab -e`) debe haber ejecutado `npx -y @insforge/cli login` al menos una vez en una sesión interactiva. La CLI guarda el token en `~/.insforge` — cron lo hereda automáticamente si es el mismo usuario.

Si el cron falla porque no encuentra autenticación:
1. Abre una sesión interactiva en el VPS.
2. Ejecuta: `npx -y @insforge/cli login`.
3. Sigue los pasos de autenticación (se abre una URL en el navegador del VPS, o usa device login si no hay navegador).
4. Una vez autenticado, el cron funciona.

### 3.3 Listar backups

```bash
npx -y @insforge/cli backups list
```

Salida:
```
ID             NAME                      CREATED                SIZE
backup_xxxxx1  fluent-weekly-2026-09-01  2026-09-01T03:00:00Z   41 MB
backup_xxxxx2  fluent-weekly-2026-08-25  2026-08-25T03:00:00Z   40 MB
backup_xxxxx3  fluent-weekly-2026-08-18  2026-08-18T03:00:00Z   39 MB
```

### 3.4 Ver el backup más reciente

```bash
npx -y @insforge/cli backups latest
```

Salida:
```
ID:       backup_xxxxx1
Name:     fluent-weekly-2026-09-01
Created:  2026-09-01T03:00:00Z
Size:     41 MB
Download: https://insforge-backups.s3.amazonaws.com/... (presigned URL válida 1 hora)
```

### 3.5 Restaurar desde un backup (emergencia)

```bash
npx -y @insforge/cli backups restore <backup-id>
```

Ejemplo:
```bash
npx -y @insforge/cli backups restore backup_xxxxx1
```

El comando te pide confirmación explícita (no usa `-y` para evitar accidentes):
```
⚠️ WARNING: Restore will OVERWRITE your current database and storage.
All data written since the backup will be lost. This is irreversible.

Backup ID: backup_xxxxx1
Backup date: 2026-09-01T03:00:00Z

Type the backup ID to confirm: backup_xxxxx1
```

Copia y pega el ID. Luego presiona Enter.

El restauro tarda típicamente 2–5 minutos. Durante ese tiempo:
- La BD no está disponible (API retorna 503).
- Coolify lo detecta y lo anota en logs.
- Una vez terminado, la API vuelve online automáticamente.

**Advertencias:**
- **Irreversible.** Todos los datos desde el backup se pierden.
- **Afecta a producción.** Los usuarios ven que la app está offline unos minutos.
- **Storage también se restaura.** En cloud, los archivos subidos por usuarios tras la fecha del backup desaparecen.
- **Solo BD en self-hosted.** Si usaras un backend OSS en Docker, solo se restaura Postgres; storage no (se usa `pg_restore --clean`).

---

## 4. Rotar `CREDENTIALS_MASTER_KEY` (retirado)

Esta sección describía la rotación de la clave que cifraba `provider_credentials`. Desde ADR 0005 (F5) no hay credenciales de usuario ni tabla que cifrar: la única credencial de LLM es `NINEROUTER_API_KEY`, que vive en Coolify y se rota generando una key nueva en el panel de 9router y sustituyéndola en la API y el worker.

## Resumen de comandos útiles

| Tarea | Comando |
|-------|---------|
| Crear migración | `npx -y @insforge/cli db migrations new <nombre>` |
| Aplicar migraciones | `npx -y @insforge/cli db migrations up --all` |
| Crear rama | `npx -y @insforge/cli branch create <nombre> --mode schema-only` |
| Fusionar rama (preview) | `npx -y @insforge/cli branch merge <nombre> --dry-run` |
| Fusionar rama (apply) | `npx -y @insforge/cli branch merge <nombre>` |
| Listar ramas | `npx -y @insforge/cli branch list` |
| Crear backup manual | `npx -y @insforge/cli backups create --name "fluent-$(date +%F)" --wait` |
| Listar backups | `npx -y @insforge/cli backups list` |
| Restaurar backup | `npx -y @insforge/cli backups restore <backup-id>` |
| Rotar `INSFORGE_API_KEY` | `npx -y @insforge/cli secrets rotate api-key` |
| Ver logs | `npx -y @insforge/cli logs postgres.logs` |
| Diagnóstico | `npx -y @insforge/cli diagnose` |

---

## Notas finales

- **Documentación en PRs:** cada migración debe documentarse en el PR que la introduce (qué tablas, qué políticas, qué se probó).
- **Backups antes de cambios:** si vas a hacer cambios grandes, crea un backup manual antes.
- **Ramas para cambios arriesgados:** siempre prueba en rama antes de aplicar a producción.
- **Supuesto de autenticación:** este runbook asume que la CLI está autenticada (`~/.insforge` con token válido) en la sesión del operador. Si algo falla con `UNAUTHENTICATED` o `exit code 2`, ejecuta `npx -y @insforge/cli login` nuevamente.
