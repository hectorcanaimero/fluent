/**
 * Escenario de una sesión: el bloque `{scenario_or_topic_block}` del prompt de
 * turno (SPEC-03 §4.1) y la etiqueta legible que se guarda en `sessions.topic`.
 *
 * Se usa desde dos sitios y por eso vive aquí y no dentro de `SessionsService`:
 *
 * 1. **Apertura** (`POST /sessions`, T1): el escenario se resuelve a partir del
 *    cuerpo de la petición (`roleplayId`, `newsItemId`, el tema del boss…).
 * 2. **Turno** (`POST /sessions/:id/turns`, T2): la petición ya no trae nada de
 *    eso, así que el escenario se **reconstruye** a partir de la fila de
 *    `sessions` (`kind`, `topic`, `news_item_id`) y del catálogo, para que el
 *    tutor siga con el mismo rol/situación/noticia con el que abrió.
 *
 * La reconstrucción es best-effort a propósito: ver `rebuildScenario`.
 */
import {
  BOSS_TOPICS,
  ROLEPLAYS,
  type BossTopic,
  type Roleplay,
} from '../content/index.js';
import type { NewsItem, Session, SessionKind } from '../db/schema.js';
import type { NewsScenario, RoleplayScenario } from '../llm/prompts/turn.js';
import { resolveFreeTopicPrompt } from './topic-prompt.js';

/** Lo que se resuelve del `kind` antes de tocar la base (SPEC-04 §3.2). */
export interface SessionScenario {
  /** Etiqueta legible que se guarda en `sessions.topic`. */
  readonly topic: string;
  /** Bloque de tema en inglés para el prompt (`free_topic` y `boss`). */
  readonly promptTopic?: string;
  readonly roleplay?: RoleplayScenario;
  readonly news?: NewsScenario;
  readonly newsItemId?: string;
}

/** `free_topic`: el texto lo escribe el usuario; ver `topic-prompt.ts`. */
export function freeTopicScenario(topic: string): SessionScenario {
  return { topic, promptTopic: resolveFreeTopicPrompt(topic) };
}

/** `roleplay`: `sessions.topic` guarda `title_es`; el prompt, rol y situación. */
export function roleplayScenario(roleplay: Roleplay): SessionScenario {
  return {
    topic: roleplay.title_es,
    roleplay: { role: roleplay.role, situation: roleplay.situation },
  };
}

/** `news`: `sessions.topic` guarda el titular (ya en inglés). */
export function newsScenario(item: NewsItem): SessionScenario {
  return {
    topic: item.title,
    news: { title: item.title, summary: item.summary ?? '' },
    newsItemId: item.id,
  };
}

/** `boss`: `sessions.topic` guarda `title_es`; el prompt usa `prompt_en`. */
export function bossScenario(topic: BossTopic): SessionScenario {
  return { topic: topic.title_es, promptTopic: topic.prompt_en };
}

/** Entrada de `ROLEPLAYS` cuyo `title_es` es exactamente `topic`. */
export function findRoleplayByTitleEs(topic: string): Roleplay | undefined {
  return ROLEPLAYS.find((entry) => entry.title_es === topic);
}

/** Entrada de `BOSS_TOPICS` cuyo `title_es` es exactamente `topic`. */
export function findBossTopicByTitleEs(topic: string): BossTopic | undefined {
  return BOSS_TOPICS.find((entry) => entry.title_es === topic);
}

/** Escenario reconstruido a partir de una sesión ya existente. */
export interface RebuiltScenario extends SessionScenario {
  /**
   * `kind` **efectivo** para el prompt. Normalmente el de la sesión; es
   * `'free_topic'` cuando el original no se pudo reconstruir (ver abajo).
   */
  readonly kind: SessionKind;
  /** `true` si se cayó al bloque `free_topic` por no poder reconstruir. */
  readonly fallback: boolean;
}

/**
 * Reconstruye el escenario de una sesión ya abierta para los turnos
 * siguientes (SPEC-04 §4 paso 4).
 *
 * `sessions` no guarda el `roleplayId` ni el `bossTopicId`: solo el `topic`
 * legible, que por decisión de la sesión líder es exactamente el `title_es`
 * de la entrada del catálogo. Por eso la búsqueda es por `title_es`. Para
 * `news` sí hay `news_item_id`, pero la fila puede haberse borrado por
 * retención (SPEC-01 §4), así que `newsItem` puede llegar `null`.
 *
 * **Nunca falla** (decisión documentada en docs/specs/pendientes/PR-04.md): si
 * el escenario original ya no existe —noticia purgada, `title_es` que
 * desapareció del catálogo tras editarlo— se cae al bloque `free_topic` con el
 * `topic` guardado. Una sesión a medias no puede quedarse sin poder continuar
 * porque cambiara un JSON del catálogo; el aprendiz pierde el matiz del rol o
 * del reto, pero sigue hablando del mismo tema.
 */
export function rebuildScenario(
  session: Pick<Session, 'kind' | 'topic' | 'news_item_id'>,
  newsItem: NewsItem | null = null,
): RebuiltScenario {
  switch (session.kind) {
    case 'free_topic':
      return { kind: 'free_topic', fallback: false, ...freeTopicScenario(session.topic) };

    case 'roleplay': {
      const roleplay = findRoleplayByTitleEs(session.topic);
      return roleplay
        ? { kind: 'roleplay', fallback: false, ...roleplayScenario(roleplay) }
        : degradeToFreeTopic(session.topic);
    }

    case 'news':
      return newsItem
        ? { kind: 'news', fallback: false, ...newsScenario(newsItem) }
        : degradeToFreeTopic(session.topic);

    case 'boss': {
      const bossTopic = findBossTopicByTitleEs(session.topic);
      return bossTopic
        ? { kind: 'boss', fallback: false, ...bossScenario(bossTopic) }
        : degradeToFreeTopic(session.topic);
    }
  }
}

function degradeToFreeTopic(topic: string): RebuiltScenario {
  return { kind: 'free_topic', fallback: true, ...freeTopicScenario(topic) };
}
