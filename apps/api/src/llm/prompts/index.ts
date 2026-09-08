/**
 * Prompts tipados del tutor (SPEC-03 §4).
 *
 * `PROMPT_VERSION` sube cada vez que cambia el texto de un prompt y se registra en
 * `llm_calls` (ver PENDIENTES PEND-02: falta la columna en SPEC-01 §2.14).
 */
export const PROMPT_VERSION = '1';

export * from './languages.js';
export * from './truncate.js';
export * from './turn.js';
export * from './brief.js';
export * from './weekly.js';
