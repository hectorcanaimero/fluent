# ADR 0005 — LLM vía 9router del operador y planes Free/Pro

Fecha: 2026-09-23 · Estado: Aceptado

## Contexto

El ADR 0002 (LLM 100 % BYOK) funcionó en v1 pero mantiene ~3 700 líneas de código de PKCE, cifrado y pantalla de proveedores. El operador ya tiene un 9router desplegado con conexiones a múltiples proveedores (OpenCode Free, OpenRouter, NVIDIA NIM, Cloudflare, Gemini, DeepSeek, OpenAI). El principio original de "cero costo para el operador" se reemplaza por "cero fricción para el usuario": cada aprendiz conecta su credencial hoy para usar el LLM; con este cambio, el login es solo social (Google y Apple, ya existente), y el operador controla el presupuesto y la calidad con planes.

## Decisión

Seis decisiones concretas reemplazan el BYOK:

- **D1 — Cliente LLM.** Chosen: Vercel AI SDK 7 con `@ai-sdk/openai-compatible`. Rejected: mantener `llm.client.ts` porque son 700 líneas que hacen lo mismo que el SDK y sin tests de terceros.
- **D2 — Fallback entre proveedores.** Chosen: combos de 9router. Rejected: cadena `FALLBACK_MODELS` larga en la API, porque duplica lo que 9router ya hace y multiplica los reintentos.
- **D3 — Salida estructurada.** Chosen: `json_object` + instrucción en el prompt + `experimental_repairText` con `extractFirstJsonObject`. Rejected: `supportsStructuredOutputs` porque manda `json_schema` estricto y los free tiers lo rechazan.
- **D4 — Transición.** Chosen: en F1 `CredentialsService.listActive` devuelve la credencial del operador, así sesiones y jobs no cambian hasta F5. Rejected: reescribir sesiones y jobs en F1, porque dispara el tamaño del PR y no aporta nada al usuario.
- **D5 — Verdad del plan.** Chosen: columna en `profiles` escrita solo por la API. Rejected: consultar RevenueCat en cada petición, por latencia y por acoplar el turno a un tercero.
- **D6 — Reintentos.** Chosen: `maxRetries: 0` en el SDK para turnos, `TURN_MAX_ATTEMPTS = 2` en `LlmService`. Rejected: dejar los 2 reintentos del SDK, porque con los de 9router suman más de un minuto de silencio.

La API habla con 9router con una sola key (variable de entorno, nunca en cliente). El plan Free usa un combo de free tiers curado por el operador; el plan Pro desbloquea modelos de pago. Ambos planes se escriben desde la API: Pro se compra vía RevenueCat (webhook).

## Alternativas consideradas

- **Mantener BYOK, solo añadir planes.** Descartado: la fricción del login no desaparece. Si el usuario no tiene credencial, el plan Pro tampoco le da nada.
- **Router compartido entre múltiples operadores.** Descartado: cada operador controla su presupuesto y su lista de combos.
- **Reintentos en la app.** Descartado: la app no llama al LLM directamente; la API es la única que intenta. Si aparecen reintentos en la app, es bug, no feature.

## Consecuencias

- El operador paga LLM: fluent-free es cuota compartida entre todos los usuarios Free; fluent-pro es presupuesto del plan pago.
- Los datos del aprendiz (prompts, hechos, transcripciones) pasan por los proveedores del combo: OpenCode, OpenRouter, NVIDIA NIM, Cloudflare, Gemini API, DeepSeek, OpenAI. Aclaración requerida en los términos de uso del operador y en las configuraciones de privacidad de cada servicio.
- El módulo `providers/` desaparece en F5 junto con la tabla `provider_credentials`. BYOK es material muerto.
- La pantalla de proveedores de la app desaparece. Login es solo social.
- Cambio de modelo de riesgo: en BYOK, cada usuario es responsable de su credencial y su presupuesto. Con 9router, el operador controla el combo pero es responsable de la cuota. Mitigación: tope diario de turnos Free (30) desde el día uno, y combo de cuatro proveedores para distribuir carga.
