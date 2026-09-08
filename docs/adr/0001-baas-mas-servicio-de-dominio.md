# ADR 0001 — BaaS (InsForge) + servicio de dominio (NestJS) + jobs (BullMQ)

Fecha: 2026-09-08 · Estado: Aceptado

## Contexto
Fluent necesita auth, Postgres y storage (commodities), lógica de negocio con estado de sesión y streaming (turnos de conversación), y trabajo en background con reintentos (coaching brief, RSS diario, resumen semanal). El PRD exige costo cero de LLM, todo autoalojado y que la arquitectura sea material de estudio.

## Decisión
Tres piezas con responsabilidades separadas:
- **InsForge Cloud** provee identidad, Postgres y storage. No contiene lógica de negocio. Se eligió la versión gestionada frente a la autoalojada: cero operación, CLI con ramas de backend y backups, correos de auth incluidos. Es el mismo software open source, así que autoalojar después es un cambio de variables de entorno y una migración de datos.
- **NestJS API** construye prompts, habla con los proveedores de LLM con las credenciales del usuario, aplica reglas de XP y streaks y expone los endpoints de sesión. Verifica los JWT emitidos por InsForge.
- **NestJS Worker** (mismo código, otro proceso) consume colas BullMQ sobre Redis para los jobs asíncronos.

La app Flutter habla con InsForge para auth y con la API para todo lo demás.

## Alternativas consideradas
- **Todo en edge functions de InsForge.** Descartado: BullMQ necesita un worker persistente y el streaming necesita estado de sesión. Además InsForge Compute está en private preview.
- **Supabase / Firebase.** Descartado por dependencia de proveedor cerrado o por no ser trivial de autoalojar completo.
- **Postgres + Auth propios en NestJS.** Descartado: reimplementar auth y storage no aporta nada al estudio y sí superficie de error.

## Consecuencias
- En el VPS solo corren dos procesos Node (API y worker) más Redis. InsForge no consume recursos locales.
- Dependencia de un proveedor gestionado. Mitigación: exportaciones periódicas con `insforge backups` y software open source idéntico para autoalojar si hiciera falta.
- La API debe validar tokens de InsForge; se documenta en el ADR de auth cuando se implemente.
- El modelo de datos de negocio vive en el Postgres de InsForge, con migraciones versionadas en el repo.
