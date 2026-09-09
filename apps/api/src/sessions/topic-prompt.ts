/**
 * Resolución del bloque de tema en inglés para `kind = 'free_topic'`.
 *
 * `sessions.topic` guarda siempre una etiqueta legible por humanos (es lo que
 * ven el leaderboard y los desafíos, SPEC-07 §7/§9). En `free_topic` ese texto
 * lo escribe el usuario, normalmente en español, pero el prompt del tutor va
 * en inglés (SPEC-03 §4.1). El catálogo `TOPICS`
 * (`apps/api/src/content/topics.json`) tiene las dos versiones de los 60 temas
 * sugeridos: `title_es` es justo lo que `GET /sessions/suggestions` le ofrece
 * a la app, y `prompt_en` la formulación en inglés.
 *
 * Regla (decisión de la sesión líder, ver docs/specs/pendientes/PR-04.md): si
 * el texto coincide **exactamente** con el `title_es` de una entrada de
 * `TOPICS`, se usa su `prompt_en`; si no (tema libre escrito a mano), se usa
 * el texto tal cual.
 */
import { TOPICS, type Topic } from '../content/index.js';

/** Entrada de `TOPICS` cuyo `title_es` es exactamente `topic`, o `undefined`. */
export function findTopicByTitleEs(topic: string): Topic | undefined {
  return TOPICS.find((entry) => entry.title_es === topic);
}

/**
 * Texto en inglés que va al `{scenario_or_topic_block}` de SPEC-03 §4.1 para
 * `free_topic`. El `topic` que se guarda en `sessions.topic` no cambia: esta
 * función solo traduce lo que ve el modelo.
 */
export function resolveFreeTopicPrompt(topic: string): string {
  return findTopicByTitleEs(topic)?.prompt_en ?? topic;
}
