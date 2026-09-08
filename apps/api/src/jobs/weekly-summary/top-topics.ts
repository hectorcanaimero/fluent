/**
 * "Top 3 temas por miembro" (SPEC-05 §4 paso 2).
 *
 * `weekly_leaderboard` no da temas, así que el repositorio trae los
 * `topic` de las sesiones `ended` del miembro dentro de la semana (ver
 * `week-range.ts`) y esta función pura los agrega: se agregan en TypeScript
 * en vez de un `GROUP BY` SQL porque es más simple con el cliente PostgREST
 * (SPEC-05 §4, nota de la sesión líder).
 */

/** Cuántos temas devolver por miembro (SPEC-05 §4: "top 3 temas"). */
export const TOP_TOPICS_LIMIT = 3;

/**
 * Cuenta ocurrencias de cada tema y devuelve los `limit` más frecuentes.
 * Empates se resuelven alfabéticamente para que el resultado sea
 * determinista (la spec no dice cómo desempatar).
 */
export function computeTopTopics(
  topics: readonly string[],
  limit: number = TOP_TOPICS_LIMIT,
): string[] {
  const counts = new Map<string, number>();
  for (const topic of topics) {
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([topicA, countA], [topicB, countB]) => {
      if (countA !== countB) return countB - countA;
      return topicA.localeCompare(topicB);
    })
    .slice(0, limit)
    .map(([topic]) => topic);
}
