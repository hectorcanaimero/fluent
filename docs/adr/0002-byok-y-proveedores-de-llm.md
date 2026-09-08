# ADR 0002 — LLM 100 % BYOK con adaptador compatible con OpenAI

Fecha: 2026-09-08 · Estado: Aceptado

## Contexto
Principio rector del PRD: el operador no paga LLM. Cada usuario aporta su propia cuenta. En v1 se soportan OpenRouter (OAuth PKCE, modelos gratuitos y pagos) y Google Gemini vía API key de Google AI Studio (RF-2.1, RF-2.8). El usuario elige modelo por rol: conversación y coaching brief (RF-2.7).

## Decisión
- Un único adaptador `LlmClient` que habla el protocolo de chat completions compatible con OpenAI. Cada proveedor es una configuración: URL base, cabecera de auth y catálogo de modelos.
  - OpenRouter: `https://openrouter.ai/api/v1`
  - Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`
- Las credenciales se guardan cifradas (AES-256-GCM con clave del servidor) en `provider_credentials`, una fila por usuario y proveedor. Nunca vuelven al cliente.
- Salida estructurada obligatoria validada con esquema (zod). Ante JSON inválido: un reintento con el siguiente modelo de la cadena de fallback gratuita y luego degradación controlada.
- Cadena de fallback gratuita configurable por el operador, siempre debajo de la elección del usuario.

## Alternativas consideradas
- **Solo OpenRouter, con las keys de otros proveedores cargadas dentro de OpenRouter.** Descartado en v1: comisión adicional y un salto más de latencia.
- **SDKs oficiales por proveedor.** Descartado: el endpoint compatible con OpenAI cubre lo necesario y mantiene un solo camino de código.
- **Key del operador compartida.** Descartado: rompe el principio de costo cero.

## Consecuencias
- Añadir un proveedor nuevo es una entrada de configuración, no código nuevo.
- Hay que registrar por llamada modelo, tokens y latencia para el costo estimado por sesión (RF-2.6).
- Las funciones específicas de un proveedor (por ejemplo, herramientas o modos de audio) quedan fuera de v1.
