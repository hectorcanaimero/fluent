# Architecture Decision Records

Una decisión por archivo, numeradas, inmutables una vez aceptadas. Si una decisión cambia, se escribe un ADR nuevo que la reemplaza y se marca el anterior como "Reemplazado por".

Formato: Contexto → Decisión → Alternativas consideradas → Consecuencias.

| # | Título | Estado |
|---|---|---|
| [0001](0001-baas-mas-servicio-de-dominio.md) | BaaS (InsForge) + servicio de dominio (NestJS) + jobs (BullMQ) | Aceptado |
| [0002](0002-byok-y-proveedores-de-llm.md) | LLM 100 % BYOK con adaptador compatible con OpenAI | Reemplazado por 0005 |
| [0003](0003-voz-nativa-en-el-dispositivo.md) | STT y TTS nativos en el móvil | Aceptado |
| [0004](0004-monorepo-y-despliegue-en-coolify.md) | Monorepo pnpm y despliegue en Coolify sobre el VPS | Aceptado |
| [0005](0005-llm-via-9router-y-planes.md) | LLM vía 9router del operador y planes Free/Pro | Aceptado |
