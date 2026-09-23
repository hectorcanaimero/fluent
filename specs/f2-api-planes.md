---
type: spec
project_id: fluent
phase: 2
version: 0.1
depends_on:
  - docs/arch/001-9router-y-planes.md
consumed_by:
  - orch-atomizer
generated_by: orch-spec
generated_at: 2026-09-23
title: Planes Free y Pro en la API
---

# F2 — Planes Free y Pro en la API

Cada perfil tiene un plan. Free usa el combo gratuito y un tope diario bajo;
Pro elige modelos de pago y tiene tope alto. El owner fija el plan a mano
hasta que exista el cobro (F4). Arquitectura: `docs/arch/001-9router-y-planes.md`,
secciones *Plans*, *Data model* e *Interfaces*.

Contexto del repo: `apps/api` es NestJS 12 en ESM sobre Node 24 con vitest;
imports internos con sufijo `.js`; comentarios en español.

## F2.1 — Package: datos del plan

### F2.1.T1 — Columnas de plan y helper isPro

- Migración `apps/api/migrations/20260923130000_planes.sql`:
  `ALTER TABLE public.profiles ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro'))`
  y `ADD COLUMN plan_expires_at timestamptz`. Mantener las políticas RLS
  actuales de `profiles` (el usuario lee su fila; solo la API escribe): revisar
  la migración `20260908171114_grupos-invitaciones-perfiles.sql` para que las
  columnas nuevas no queden escribibles por `authenticated`.
- `apps/api/src/db/schema.ts`: `export type Plan = 'free' | 'pro'`;
  `Profile.plan: Plan`, `Profile.plan_expires_at: string | null`.
- `apps/api/src/profiles/plan.ts`: `isPro(profile: Pick<Profile,'plan'|'plan_expires_at'>, now = new Date()): boolean`
  y `effectivePlan(profile, now): Plan`. Un `pro` con `plan_expires_at` en el
  pasado cuenta como `free`.

Done when: `plan.spec.ts` cubre free, pro sin fecha, pro vigente, pro vencido,
fecha inválida; `build` pasa.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 1.5h
- **Reason**: Migración corta y una función pura.
- **Dependencies**:
- **Files**:
  - `apps/api/migrations/20260923130000_planes.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/profiles/plan.ts`
  - `apps/api/src/profiles/plan.spec.ts`

## F2.2 — Package: plan en el LLM

### F2.2.T1 — Resolver por plan, PLAN_REQUIRED y topes diarios

- `apps/api/src/llm/model-resolver.ts`: `resolve({ plan, preference, fallbackModels? })`.
  Free → `[{ '9router', FREE_COMBO, source: 'fallback' }]` y
  `preferenceDropped = preference != null`. Pro → `[preference (source 'preference'), fluent-pro, fluent-free]`
  sin duplicados. `Candidate` pierde `apiKey`; desaparecen `ActiveCredential`
  y `CredentialsSource` de este fichero (los llamadores de F1.3 que aún los
  importen pasan a importarlos de `credentials/`, o se borran si ya no se usan).
- `apps/api/src/llm/llm.service.ts`: `LlmServiceRequest.credentials` se
  sustituye por `plan: Plan`. Los llamadores (`sessions.service.ts`,
  `turns.service.ts`, `coaching-brief.service.ts`, `weekly-summary.service.ts`)
  pasan `effectivePlan(profile)` en vez de credenciales. No borrar aún la
  sesión de cortesía (es de F5), solo dejar de pasarle credenciales al LLM.
- `apps/api/src/common/api-error.ts`: `PLAN_REQUIRED: 403`.
- `apps/api/src/models/models.service.ts`: en `updatePreferences`, si
  `effectivePlan(profile) === 'free'` y algún modelo elegido tiene tier ≠ `free`
  en el catálogo → `ApiException.of('PLAN_REQUIRED', 'Elegir un modelo de pago requiere el plan Pro.')`.
- `apps/api/src/config/env.ts`: `TURNS_DAILY_CAP` se reemplaza por
  `TURNS_DAILY_CAP_FREE` (default 30) y `TURNS_DAILY_CAP_PRO` (default 120),
  enteros ≥ 0, 0 desactiva. `.env.example` acorde.
- `apps/api/src/sessions/turns.service.ts` `requireDailyTurnsBudget`: elige el
  tope según `isPro(profile)`. El mensaje para Free menciona que Pro amplía el
  tope.

Done when: `model-resolver.spec.ts` cubre las cuatro combinaciones (free con
y sin preferencia, pro con y sin preferencia); `models.service.spec.ts` cubre
`PLAN_REQUIRED`; `turns.service.spec.ts` cubre tope free vs pro; `test/session-turns.e2e-spec.ts` pasa.

- **Model**: claude/claude-opus-5-5
- **Estimate**: 5h
- **Reason**: Toca la ruta caliente del turno y la firma de `LlmService`; errores aquí bloquean todas las sesiones.
- **Dependencies**: F2.1.T1, F1.2.T1, F1.4.T1
- **Files**:
  - `apps/api/src/llm/model-resolver.ts`
  - `apps/api/src/llm/model-resolver.spec.ts`
  - `apps/api/src/llm/llm.service.ts`
  - `apps/api/src/llm/llm.service.spec.ts`
  - `apps/api/src/common/api-error.ts`
  - `apps/api/src/models/models.service.ts`
  - `apps/api/src/models/models.service.spec.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.spec.ts`
  - `apps/api/.env.example`
  - `apps/api/.env.test`
  - `apps/api/src/sessions/turns.service.ts`
  - `apps/api/src/sessions/turns.service.spec.ts`
  - `apps/api/src/sessions/sessions.service.ts`
  - `apps/api/src/sessions/sessions.service.spec.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.service.ts`
  - `apps/api/src/jobs/coaching-brief/coaching-brief.service.spec.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.service.ts`
  - `apps/api/src/jobs/weekly-summary/weekly-summary.service.spec.ts`
  - `apps/api/test/session-turns.e2e-spec.ts`

## F2.3 — Package: plan en HTTP

### F2.3.T1 — GET /me con plan y PUT /admin/users/:id/plan

- `apps/api/src/profiles/profiles.types.ts`: `MeDto` gana `plan: Plan` y
  `planExpiresAt: string | null`; pierde `providers`. `profiles.service.ts`
  deja de llamar a `CredentialsService.listStatuses`.
- `apps/api/src/admin`: `PUT /admin/users/:id/plan` con DTO
  `{ plan: 'free' | 'pro', expiresAt?: string | null }` (class-validator,
  `expiresAt` ISO 8601 o null). Solo `OWNER_USER_ID`, mismo guard que
  `GET /admin/metrics`; otro usuario `403 FORBIDDEN`; `id` inexistente
  `404 NOT_FOUND`. Escribe `profiles.plan` y `plan_expires_at` con la clave
  admin y responde `{ userId, plan, planExpiresAt }`. Registrar en el log quién
  cambió el plan de quién.
- OpenAPI (`apps/api/src/openapi.ts` o decoradores) refleja ambos cambios.

Done when: `profiles.service.spec.ts` y `admin.service.spec.ts` cubren los
casos; `test/admin.e2e-spec.ts` cubre 200 owner, 403 no owner, 404; el
contrato de `GET /me` en `docs/specs/SPEC-02-auth-y-api.md` §4.1 se actualiza
en la misma tarea.

- **Model**: claude/claude-sonnet-5
- **Estimate**: 3h
- **Reason**: CRUD con guard existente.
- **Dependencies**: F2.1.T1
- **Files**:
  - `apps/api/src/profiles/profiles.types.ts`
  - `apps/api/src/profiles/profiles.service.ts`
  - `apps/api/src/profiles/profiles.service.spec.ts`
  - `apps/api/src/profiles/profiles.module.ts`
  - `apps/api/src/admin/admin.controller.ts`
  - `apps/api/src/admin/admin.service.ts`
  - `apps/api/src/admin/admin.service.spec.ts`
  - `apps/api/src/admin/admin.repository.ts`
  - `apps/api/src/admin/admin.types.ts`
  - `apps/api/src/admin/dto/update-user-plan.dto.ts`
  - `apps/api/test/admin.e2e-spec.ts`
  - `docs/specs/SPEC-02-auth-y-api.md`
