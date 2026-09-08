/**
 * Tokens de inyección y nombre del evento de la infraestructura del módulo
 * LLM que aporta PR-02/T4 (`LlmInfraModule`).
 *
 * Viven en su propio fichero para que `CredentialErrorListener` (en
 * `src/credentials/`) pueda importar el nombre del evento sin importar el
 * módulo entero, evitando un ciclo `CredentialsModule` ↔ `LlmInfraModule`.
 */

/** Evento que emite `LlmService` ante un 401/403/402 del proveedor (SPEC-03 §2). */
export const CREDENTIAL_ERROR_EVENT = 'credential.error';

/** `LlmCallSink` de `apps/api/src/llm/llm.service.ts` (escribe en `llm_calls`). */
export const LLM_CALL_SINK = Symbol('LLM_CALL_SINK');

/** `LlmEventBus` de `apps/api/src/llm/llm.service.ts` (sobre `EventEmitter2`). */
export const LLM_EVENT_BUS = Symbol('LLM_EVENT_BUS');
