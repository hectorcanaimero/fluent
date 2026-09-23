---
type: prd
project_id: fluent
version: 0.1
status: accepted
generated_by: orch-prd
generated_at: 2026-09-23
title: IA vía 9router del operador, planes Free y Pro
source: https://claude.ai/artifact/8ftJFoYwjWNAPNuLp4Zc3N
---

# IA vía 9router del operador, planes Free y Pro

## Problema

Fluent hoy es 100 % BYOK (ADR 0002): cada aprendiz conecta OpenRouter por PKCE o
pega una key de Gemini, y sin credencial no puede practicar. Ese paso frena el
alta y obliga a mantener ~3 700 líneas de PKCE, cifrado y pantalla de proveedores.
El operador ya tiene un 9router desplegado con conexiones a OpenCode Free,
OpenRouter, NVIDIA NIM, Cloudflare, Gemini, DeepSeek y OpenAI.

## Decisión

La API habla con el 9router del operador con una sola key. El plan Free usa un
combo de free tiers; el plan Pro desbloquea modelos de pago. El login es social
(Google y Apple), que ya existe en la app. Reemplaza al ADR 0002.

## Requisitos funcionales

| Id | Requisito | Prioridad |
| --- | --- | --- |
| RF-1 | La API llama a 9router (`NINEROUTER_URL`, `NINEROUTER_API_KEY`) como único proveedor de LLM. Ningún usuario aporta credenciales. | P0 |
| RF-2 | El cliente LLM es el Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`): `generateObject` para brief y resumen semanal, `streamObject` para el turno. Los esquemas zod existentes no cambian. | P0 |
| RF-3 | Cada perfil tiene `plan` (`free` o `pro`) y `plan_expires_at`. Un usuario es Pro si `plan = 'pro'` y la fecha es nula o futura. Por defecto todos son Free. | P0 |
| RF-4 | Free usa siempre el combo `fluent-free`. No elige modelo. La preferencia de modelo se ignora. | P0 |
| RF-5 | Pro usa su preferencia de modelo (chat y brief por separado), después `fluent-pro`, después `fluent-free`. Elegir un modelo de pago sin ser Pro responde `403 PLAN_REQUIRED`. | P0 |
| RF-6 | Tope diario de turnos por plan: `TURNS_DAILY_CAP_FREE` (30) y `TURNS_DAILY_CAP_PRO` (120). | P0 |
| RF-7 | El owner puede fijar el plan de un usuario con `PUT /admin/users/:id/plan`. | P0 |
| RF-8 | `GET /me` devuelve `plan` y `planExpiresAt` y deja de devolver `providers`. | P0 |
| RF-9 | El catálogo `GET /models` sale de `GET {9router}/v1/models` cruzado con una lista fija del operador que fija tier y precio de referencia. | P1 |
| RF-10 | La app elimina la pantalla de proveedores y el flujo PKCE; añade una pantalla de plan en ajustes; el selector de modelo solo aparece para Pro. | P0 |
| RF-11 | Los jobs de brief y resumen semanal usan la credencial del operador; desaparece el aviso `weekly_summary_credential_missing`. | P0 |
| RF-12 | Login social Google y Apple (ya implementado en la app) es el único login. Se verifica la configuración en InsForge. | P1 |
| RF-13 | Cobro del plan Pro por RevenueCat (Apple IAP y Google Play Billing); un webhook en la API es el único escritor de `plan`. | P2 |
| RF-14 | Se borra el BYOK: módulos `providers/` y `credentials/`, tabla `provider_credentials`, sesión de cortesía, variables `CREDENTIALS_MASTER_KEY*` y `OPENROUTER_OAUTH_CALLBACK`. ADR 0005 reemplaza al 0002; PRD y SPEC-02/03/08 se actualizan. | P1 |

## Requisitos no funcionales

| Id | Requisito |
| --- | --- |
| RNF-1 | Un turno con `fluent-free` responde con p90 < 8 s y JSON válido ≥ 95 % (bench de 20 turnos B1, SPEC-03 §9). |
| RNF-2 | La key de 9router solo vive en el entorno de la API y del worker. Nunca en logs, respuestas ni base de datos. |
| RNF-3 | `llm_calls` sigue registrando modelo, tokens, latencia y estado por intento. |
| RNF-4 | Reintentos: el SDK con `maxRetries: 0` en turnos; 9router y `LlmService` se reparten los intentos. Un turno nunca tarda más de 50 s en degradarse. |
| RNF-5 | Datos del aprendiz solo van a proveedores de API (OpenRouter, NIM, Cloudflare, OpenCode, DeepSeek, OpenAI, Gemini API). Fuera de los combos: Gemini CLI, Claude Code, Antigravity. |

## Fuera de alcance

- Precio del plan Pro. Se decide en RF-13.
- Migrar las keys ya conectadas: se borran en la migración y la app no avisa.
- Salida estructurada estricta (`json_schema`) en el SDK: varios free tiers la rechazan.

## Prerrequisito del operador (sin código)

En el panel de 9router: crear los combos `fluent-free` (OpenCode Free,
OpenRouter :free, NVIDIA NIM, Cloudflare) y `fluent-pro` (DeepSeek, Gemini,
OpenAI), generar una API key para Fluent y arrancar con `REQUIRE_API_KEY=true`.
