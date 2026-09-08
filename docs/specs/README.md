# Especificaciones técnicas de Fluent

Las specs traducen el PRD (`docs/PRD.md`, v1.1) a decisiones implementables. Un agente o una persona debe poder construir cada módulo leyendo su spec sin inventar nada. Si algo no está aquí, se pregunta o se añade a la spec antes de programarlo.

| Spec | Alcance | Fase del PRD |
|---|---|---|
| [SPEC-01 Modelo de datos](SPEC-01-modelo-de-datos.md) | Tablas, RLS, funciones RPC, migraciones | 0 |
| [SPEC-02 Auth y contrato de API](SPEC-02-auth-y-api.md) | Verificación de tokens, endpoints, DTOs, errores | 0, 1 |
| [SPEC-03 LLM y prompts](SPEC-03-llm-y-prompts.md) | Adaptador, proveedores, prompts, esquemas JSON, fallback | 1, 2 |
| [SPEC-04 Sesión de conversación](SPEC-04-sesion-de-conversacion.md) | Ciclo de vida, turnos, temporizador, cierre | 1 |
| [SPEC-05 Jobs en background](SPEC-05-jobs.md) | BullMQ: brief, RSS, resumen semanal, mantenimiento | 2, 4, 5 |
| [SPEC-06 App móvil](SPEC-06-app-movil.md) | Pantallas, navegación, voz, estado, seguridad | 0, 1, 2 |
| [SPEC-07 Gamificación y social](SPEC-07-gamificacion-y-social.md) | Reglas de XP, streaks, leaderboard, desafíos | 3, 5 |
| [SPEC-08 Infraestructura](SPEC-08-infraestructura.md) | InsForge Cloud, Coolify, variables, CI, observabilidad | 0 |

## Convenciones comunes

- **Identificadores:** UUID v4 generados en base de datos.
- **Tiempo:** todo en UTC en base de datos y API (`timestamptz`, ISO 8601). La app convierte a hora local. El "día" de un usuario para streaks se calcula con su zona horaria guardada en el perfil.
- **Nombres:** tablas y columnas en `snake_case`; JSON de la API en `camelCase`; la API traduce.
- **Errores de API:** siempre `{ "error": "CODIGO_EN_MAYUSCULAS", "message": "texto para humanos", "statusCode": 4xx }`. Códigos listados en SPEC-02.
- **Constantes de producto** (duración de sesión, XP, probabilidades) viven en `apps/api/src/config/product.ts` y se listan en SPEC-07. Nunca se hardcodean en otro sitio.
- **Idioma:** la UI y los mensajes de error al usuario en español. Los prompts al tutor y las respuestas del tutor en inglés. Las notas de corrección en español.
- **Trazabilidad:** cada requisito del PRD (RF-x.y) aparece citado en la spec que lo implementa.

## Estado

| Spec | Estado |
|---|---|
| 01 a 08 | Borrador v0.1 para revisión, 2026-09-08 |
