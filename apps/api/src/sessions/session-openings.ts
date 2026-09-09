/**
 * Saludos fijos de la apertura degradada (SPEC-04 §3: «Si el LLM falla en la
 * apertura, se responde degradado con un saludo fijo por `kind` y la sesión
 * sigue activa»).
 *
 * Van en inglés, como todo lo que dice el tutor (SPEC-03 §4.1: «Reply in
 * English only»), y siguen las mismas reglas que le pedimos al modelo en la
 * apertura: una frase corta y una pregunta al final que deje al aprendiz con
 * el turno. No mencionan que hubo un fallo: el aviso de degradación lo pone la
 * app a partir de `callbackUsed`/`degraded`, no el texto del tutor.
 */
import type { SessionKind } from '../db/schema.js';

export const SESSION_OPENINGS: Readonly<Record<SessionKind, string>> = Object.freeze({
  free_topic:
    "Hi! I'm glad you're here — what would you like to say about today's topic first?",
  roleplay:
    "Hi! Let's jump straight into our scene — how would you like to start?",
  news: "Hi! I read that story too — what was your first reaction to it?",
  boss: "Hi! Today's topic is a tough one, so let's warm up — what do you already know about it?",
});

/** Saludo fijo de la apertura degradada para un `kind`. */
export function openingFor(kind: SessionKind): string {
  return SESSION_OPENINGS[kind];
}
