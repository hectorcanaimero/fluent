/**
 * Matching de tags del catálogo de intereses contra el título de una noticia
 * (SPEC-05 §3 paso 2: «tags = los del feed más palabras clave del catálogo
 * de intereses encontradas en el título»).
 *
 * `INTERESTS` (apps/api/src/content/interests.json) no tiene un campo de
 * "palabras clave" separado, solo `tags` (p. ej. `["soccer","competition",
 * "exploration"]` para football) e `id` (p. ej. `"football"`, `"space"`).
 * Los `tags` por sí solos no cubren los ejemplos obvios del catálogo (el
 * título "local team wins football championship" no contiene la palabra
 * "soccer"), así que el conjunto de palabras clave es la unión de los
 * `tags` de cada interés y las palabras de su `id` (partido por guiones:
 * "artificial-intelligence" → "artificial", "intelligence"). Ver PEND-12 de
 * docs/specs/pendientes/PR-05.md.
 *
 * Coincidencia por palabra completa, no por substring: con substring "ai"
 * (tag de artificial-intelligence) matchearía dentro de "said" o "explain".
 */
export interface InterestLike {
  readonly id: string;
  readonly tags: readonly string[];
}

export function buildInterestKeywords(
  interests: readonly InterestLike[],
): ReadonlySet<string> {
  const keywords = new Set<string>();
  for (const interest of interests) {
    for (const tag of interest.tags) {
      if (tag.trim().length > 0) keywords.add(tag.toLowerCase());
    }
    for (const part of interest.id.split('-')) {
      if (part.trim().length > 0) keywords.add(part.toLowerCase());
    }
  }
  return keywords;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Palabras clave del catálogo que aparecen como palabra completa en `title`, ordenadas. */
export function matchInterestTags(
  title: string,
  keywords: ReadonlySet<string>,
): string[] {
  const matched: string[] = [];
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
    if (pattern.test(title)) matched.push(keyword);
  }
  return matched.sort();
}
