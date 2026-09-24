/**
 * Tokens de inyección de la infraestructura del módulo LLM que aporta
 * PR-02/T4 (`LlmInfraModule`).
 */

/** `LlmCallSink` de `apps/api/src/llm/llm.service.ts` (escribe en `llm_calls`). */
export const LLM_CALL_SINK = Symbol('LLM_CALL_SINK');
