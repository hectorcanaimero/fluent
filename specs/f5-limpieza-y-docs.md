---
type: spec
project_id: fluent
phase: 5
version: 0.1
depends_on:
  - docs/arch/001-9router-y-planes.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-09-23
title: Limpieza del BYOK y documentación
---

# F5 — Limpieza del BYOK y documentación

Con F1 a F3 en `main`, el BYOK es código muerto. Se borra entero y se deja
escrito el cambio de arquitectura. Arquitectura:
`docs/arch/001-9router-y-planes.md`, sección *Data model* (migración F5) y
*Entorno*.

## F5.1 — Package: borrar BYOK

### F5.1.T1 — Borrar providers, credentials, cortesía y variables

- Borrar `apps/api/src/providers/` y `apps/api/src/credentials/` enteros
  (incluidos specs) y quitarlos de `app.module.ts` y `worker.module.ts`.
  `llm-infra.module.ts` deja de exportar `CREDENTIAL_ERROR_EVENT` si nadie lo
  escucha; `LlmService` deja de emitir `credential.error`.
- Sesión de cortesía (MAL-24): quitar `resolveCourtesy`, `courtesyCredentials`
  y todo lo que lea `session.courtesy` en `sessions.service.ts`,
  `turns.service.ts`, `sessions.repository.ts`, `session-sweeper.*`. Los
  llamadores de `LlmService` ya pasan `plan` (F2.2), así que aquí solo se
  quita código.
- Migración `apps/api/migrations/20260923140000_borrar-byok.sql`:
  `DROP TABLE public.provider_credentials;` y `ALTER TABLE public.sessions DROP COLUMN courtesy;`
  (revisar `20260911205643_sesion-de-cortesia.sql` por si dejó una función o
  un índice que borrar). `db/schema.ts` acorde.
- `config/env.ts`: quitar `CREDENTIALS_MASTER_KEY`, `CREDENTIALS_MASTER_KEY_PREVIOUS`,
  `OPENROUTER_OAUTH_CALLBACK`; `API_PUBLIC_URL` se queda solo si algo más la
  usa (comprobar con grep; si no, quitar también `suspiciousEnvWarnings` y su
  spec). `.env.example`, `.env.test` y `test/insforge-e2e.ts` acordes.
- `common/api-error.ts`: quitar `PROVIDER_NOT_CONNECTED`, `PROVIDER_KEY_INVALID`.
- `jobs/maintenance`: si había un job de recifrado de credenciales, borrarlo.
- Tests e2e en `apps/api/test/` que preparaban credenciales se limpian.

Done when: `grep -rniE "openrouter|gemini|pkce|credential" apps/api/src` solo
devuelve, como mucho, comentarios históricos en `llm/` y nombres de modelos en
`ninerouter-models.ts`; `pnpm --filter @fluent/api build`, `lint`, `test` y
`test:e2e` pasan.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 4h
- **Reason**: Borrado extenso guiado por el compilador y los tests.
- **Dependencies**: F1.3.T1, F2.2.T1, F3.2.T1
- **Files**:
  - `apps/api/src/providers/dto/connect-gemini.dto.ts`
  - `apps/api/src/providers/dto/pkce-complete.dto.ts`
  - `apps/api/src/providers/dto/pkce-start.dto.ts`
  - `apps/api/src/providers/pkce.spec.ts`
  - `apps/api/src/providers/pkce.store.ts`
  - `apps/api/src/providers/pkce.ts`
  - `apps/api/src/providers/provider-api.client.ts`
  - `apps/api/src/providers/provider-fetch.module.ts`
  - `apps/api/src/providers/providers.controller.ts`
  - `apps/api/src/providers/providers.module.ts`
  - `apps/api/src/providers/providers.service.spec.ts`
  - `apps/api/src/providers/providers.service.ts`
  - `apps/api/src/providers/providers.types.ts`
  - `apps/api/src/credentials/credential-error.listener.spec.ts`
  - `apps/api/src/credentials/credential-error.listener.ts`
  - `apps/api/src/credentials/credentials.crypto.spec.ts`
  - `apps/api/src/credentials/credentials.crypto.ts`
  - `apps/api/src/credentials/credentials.module.ts`
  - `apps/api/src/credentials/credentials.repository.ts`
  - `apps/api/src/credentials/credentials.service.spec.ts`
  - `apps/api/src/credentials/credentials.service.ts`
  - `apps/api/src/app.module.ts`
  - `apps/api/src/worker.module.ts`
  - `apps/api/src/llm/llm-infra.module.ts`
  - `apps/api/src/llm/llm-infra.constants.ts`
  - `apps/api/src/llm/llm.service.ts`
  - `apps/api/src/llm/llm.service.spec.ts`
  - `apps/api/src/sessions/sessions.service.ts`
  - `apps/api/src/sessions/sessions.service.spec.ts`
  - `apps/api/src/sessions/sessions.repository.ts`
  - `apps/api/src/sessions/turns.service.ts`
  - `apps/api/src/sessions/turns.service.spec.ts`
  - `apps/api/src/sessions/session-sweeper.service.ts`
  - `apps/api/src/sessions/session-sweeper.repository.ts`
  - `apps/api/src/jobs/maintenance/maintenance.processor.ts`
  - `apps/api/src/jobs/maintenance/maintenance.processor.spec.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.spec.ts`
  - `apps/api/.env.example`
  - `apps/api/.env.test`
  - `apps/api/src/common/api-error.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/migrations/20260923140000_borrar-byok.sql`
  - `apps/api/test/insforge-e2e.ts`
  - `apps/api/test/sessions.e2e-spec.ts`
  - `apps/api/test/session-end.e2e-spec.ts`
  - `apps/api/test/session-turns.e2e-spec.ts`
  - `apps/api/test/memory.e2e-spec.ts`
  - `apps/api/test/coaching-brief-queue.e2e-spec.ts`
  - `apps/api/scripts/db-smoke.ts`
  - `apps/api/scripts/db-test-users.ts`

## F5.2 — Package: documentación

### F5.2.T1 — ADR 0005 y actualización de PRD, SPECs y runbook

- `docs/adr/0005-llm-via-9router-y-planes.md` con el formato de los ADR
  existentes (Fecha, Estado, Contexto, Decisión, Alternativas consideradas,
  Consecuencias). Decisión y alternativas: tomar D1 a D6 de
  `docs/arch/001-9router-y-planes.md`. En Consecuencias, decir claro que el
  operador paga las cuotas y que los datos del aprendiz pasan por los
  proveedores del combo.
- `docs/adr/0002-byok-y-proveedores-de-llm.md`: Estado pasa a
  «Reemplazado por ADR 0005». `docs/adr/README.md` lista el nuevo.
- `docs/PRD.md` §6.2: reescribir RF-2.x según `docs/prd/001-9router-y-planes.md`
  (RF-2.1 a RF-2.9 pasan a describir 9router, planes y topes). §3 «Operador»
  deja de decir «cero costo de LLM». §8.2 quita `provider_credentials`.
- `docs/specs/SPEC-02-auth-y-api.md`: §4.2 sustituye los endpoints de
  proveedores por `GET /models`, `PUT /me/models` con `PLAN_REQUIRED` y
  `PUT /admin/users/:id/plan`; §5 (cifrado) se elimina; §6 quita
  `PROVIDER_*` y añade `PLAN_REQUIRED`.
- `docs/specs/SPEC-03-llm-y-prompts.md`: §1 describe el SDK y el provider;
  §2 la resolución por plan; §7 el catálogo desde 9router. §9 sigue vigente.
- `docs/specs/SPEC-08-infraestructura.md` §2: variables nuevas y borradas;
  añadir el contenedor de 9router al despliegue.
- `docs/runbooks/despliegue.md`: cómo levantar 9router (`docker run …
  -e REQUIRE_API_KEY=true`), crear los combos `fluent-free` y `fluent-pro`,
  generar la key y ponerla en Coolify; qué mirar en `/admin/metrics` la
  primera semana.

Done when: `grep -rn "BYOK\|PKCE\|CREDENTIALS_MASTER_KEY" docs/PRD.md docs/specs docs/runbooks`
solo devuelve menciones históricas marcadas como tal; los enlaces entre
documentos resuelven.

- **Model**: claude/claude-haiku-4-5-20251001
- **Estimate**: 3h
- **Reason**: Solo documentación con fuentes ya escritas.
- **Dependencies**: F5.1.T1
- **Files**:
  - `docs/adr/0005-llm-via-9router-y-planes.md`
  - `docs/adr/0002-byok-y-proveedores-de-llm.md`
  - `docs/adr/README.md`
  - `docs/PRD.md`
  - `docs/specs/SPEC-02-auth-y-api.md`
  - `docs/specs/SPEC-03-llm-y-prompts.md`
  - `docs/specs/SPEC-08-infraestructura.md`
  - `docs/runbooks/despliegue.md`
