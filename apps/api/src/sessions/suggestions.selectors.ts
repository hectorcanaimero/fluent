/**
 * Selección pura de `GET /sessions/suggestions` (SPEC-04 §7): funciones sin
 * IO ni Nest, para poder testearlas sin repositorio ni base de datos (regla
 * del diseño de PR-04: «si necesitas barajar, escribe un helper puro y
 * testéalo»).
 *
 * **`profiles.interests` no está en el mismo espacio de valores que
 * `TOPICS.tags` / `news_items.tags`** (decisión documentada en
 * docs/specs/pendientes/PR-04.md): `interests` guarda ids del catálogo
 * `INTERESTS` (`"technology"`, `"football"`…, ver
 * `src/common/validators/interests-catalog.validator.ts`), mientras que
 * `TOPICS`/`news_items` usan las etiquetas cortas de cada interés
 * (`INTERESTS[i].tags`, p. ej. `"tech"`, `"soccer"` — el mismo espacio que ya
 * usa `rss-ingest` para etiquetar noticias, `src/jobs/rss-ingest/tags.ts`).
 * `interestTagSet` hace esa traducción antes de cualquier intersección.
 */
import type { Interest, Roleplay, Topic } from '../content/index.js';
import { INTERESTS } from '../content/index.js';
import type { Level, NewsItem } from '../db/schema.js';
import type { SessionRandom } from './sessions.constants.js';
import {
  SUGGESTIONS_NEWS,
  SUGGESTIONS_ROLEPLAYS,
  SUGGESTIONS_TOPICS_MATCHING,
  SUGGESTIONS_TOPICS_TOTAL,
} from './sessions.constants.js';

/**
 * Orden de niveles CEFR usados por la app, local a este archivo. Tercera
 * copia de este orden en el repo (`src/game/boss.service.ts` y
 * `src/profiles/dto/update-profile.dto.ts` ya tienen la suya, ambas
 * documentadas como locales): no se centraliza aquí para no tocar módulos de
 * otras tareas: ver docs/specs/pendientes/PR-04.md.
 */
const LEVEL_ORDER: readonly Level[] = ['A2', 'B1', 'B2'];

function levelRank(level: Level): number {
  return LEVEL_ORDER.indexOf(level);
}

/** `true` si un `level_min` de catálogo es alcanzable por `level`. */
function isReachable(levelMin: Level, level: Level): boolean {
  return levelRank(levelMin) <= levelRank(level);
}

/** `true` si `tags` intersecta `wanted` (al menos un elemento en común). */
function intersects(tags: readonly string[], wanted: ReadonlySet<string>): boolean {
  return tags.some((tag) => wanted.has(tag));
}

/**
 * Baraja de Fisher-Yates con la fuente de aleatoriedad inyectada
 * (`SESSION_RANDOM`), para que los tests fijen el resultado. No muta
 * `items`.
 */
export function shuffle<T>(items: readonly T[], random: SessionRandom): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled;
}

/**
 * `profiles.interests` (ids de `INTERESTS`) → conjunto de sus `tags`, el
 * espacio que usan `TOPICS`/`news_items`. Ids que no existen en el catálogo
 * (perfil sembrado antes de un cambio de catálogo) se ignoran en silencio.
 */
export function interestTagSet(
  interestIds: readonly string[],
  catalog: readonly Interest[] = INTERESTS,
): ReadonlySet<string> {
  const tags = new Set<string>();
  for (const id of interestIds) {
    const interest = catalog.find((entry) => entry.id === id);
    if (interest) {
      for (const tag of interest.tags) {
        tags.add(tag);
      }
    }
  }
  return tags;
}

/**
 * `topics` de SPEC-04 §7: 6 temas de `TOPICS` que casan con `interestTags`,
 * más 2 aleatorios fuera de intereses (8 en total), todos con `level_min`
 * alcanzable. Si el catálogo filtrado por nivel no llega a 6 coincidencias,
 * se completa con temas fuera de intereses (y viceversa si faltan fuera de
 * intereses) antes que devolver menos de 8: con las 60 entradas del catálogo
 * actual y solo 3 niveles esto no debería ocurrir en producción, pero la
 * función nunca falla si el catálogo es más pequeño (por ejemplo en tests).
 * Devuelve `title_es`, que es lo que la app manda de vuelta como `topic` en
 * `POST /sessions` (`topic-prompt.ts` lo traduce a `prompt_en`).
 */
export function pickSuggestedTopics(
  topics: readonly Topic[],
  interestTags: ReadonlySet<string>,
  level: Level,
  random: SessionRandom,
): string[] {
  const reachable = topics.filter((topic) => isReachable(topic.level_min, level));
  const matching = reachable.filter((topic) => intersects(topic.tags, interestTags));
  const outside = reachable.filter((topic) => !intersects(topic.tags, interestTags));

  const shuffledMatching = shuffle(matching, random);
  const shuffledOutside = shuffle(outside, random);

  const selected: Topic[] = [];
  const usedIds = new Set<string>();

  /** Añade de `pool` hasta que `selected` llegue a `max` en total (no `max` más). */
  function addFrom(pool: readonly Topic[], max: number): void {
    for (const topic of pool) {
      if (selected.length >= max) break;
      if (!usedIds.has(topic.id)) {
        selected.push(topic);
        usedIds.add(topic.id);
      }
    }
  }

  // 1. Hasta 6 que casan con los intereses.
  addFrom(shuffledMatching, SUGGESTIONS_TOPICS_MATCHING);
  // 2. Completa hasta 8 con temas fuera de intereses (los "2 aleatorios" de
  //    SPEC-04 §7, o más si el paso 1 se quedó corto de coincidencias).
  addFrom(shuffledOutside, SUGGESTIONS_TOPICS_TOTAL);
  // 3. Si el catálogo filtrado por nivel no da ni para eso (por ejemplo un
  //    catálogo de test más pequeño), rellena con lo que quede de cualquier
  //    lado antes que devolver menos de 8.
  addFrom(shuffledMatching, SUGGESTIONS_TOPICS_TOTAL);
  addFrom(shuffledOutside, SUGGESTIONS_TOPICS_TOTAL);

  return selected.map((topic) => topic.title_es);
}

/**
 * `roleplays` de SPEC-04 §7: 4 escenarios con `level_min` alcanzable,
 * evitando `recentTitles` (los últimos `SUGGESTIONS_ROLEPLAYS_RECENT_EXCLUDE`
 * usados por el usuario). Sin aleatoriedad (SPEC-04 §7 no la pide para
 * roleplays): orden estable del catálogo, para que el criterio de aceptación
 * («excluye los roleplays recientes») sea determinista sin depender de
 * `SESSION_RANDOM`. Si excluir los recientes deja menos de 4 alcanzables, se
 * completa con los recientes (documentado: mejor repetir un roleplay que
 * ofrecer menos de 4).
 */
export function pickSuggestedRoleplays(
  roleplays: readonly Roleplay[],
  level: Level,
  recentTitles: ReadonlySet<string>,
): Roleplay[] {
  const reachable = roleplays.filter((roleplay) => isReachable(roleplay.level_min, level));
  const fresh = reachable.filter((roleplay) => !recentTitles.has(roleplay.title_es));

  const selected = fresh.slice(0, SUGGESTIONS_ROLEPLAYS);
  if (selected.length < SUGGESTIONS_ROLEPLAYS) {
    const usedIds = new Set(selected.map((roleplay) => roleplay.id));
    for (const roleplay of reachable) {
      if (selected.length >= SUGGESTIONS_ROLEPLAYS) break;
      if (!usedIds.has(roleplay.id)) {
        selected.push(roleplay);
        usedIds.add(roleplay.id);
      }
    }
  }
  return selected;
}

/**
 * `news` de SPEC-04 §7: hasta 4 noticias (ya acotadas a los últimos
 * `SUGGESTIONS_NEWS_MAX_AGE_DAYS` días por quien llama) cuyos `tags`
 * intersecten `interestTags`; si hay menos de 4, se completa con las más
 * recientes sin repetir. `recentNews` debe llegar ya ordenada de más a menos
 * reciente: esta función no reordena, solo filtra y completa.
 */
export function pickSuggestedNews(
  recentNews: readonly NewsItem[],
  interestTags: ReadonlySet<string>,
): NewsItem[] {
  const matching = recentNews.filter((item) => intersects(item.tags, interestTags));
  const selected = matching.slice(0, SUGGESTIONS_NEWS);

  if (selected.length < SUGGESTIONS_NEWS) {
    const usedIds = new Set(selected.map((item) => item.id));
    for (const item of recentNews) {
      if (selected.length >= SUGGESTIONS_NEWS) break;
      if (!usedIds.has(item.id)) {
        selected.push(item);
        usedIds.add(item.id);
      }
    }
  }
  return selected;
}
