/**
 * Regla de nivel (SPEC-05 §2, párrafo final).
 *
 * «Si `level_hint` difiere del `profile.level` en tres briefs consecutivos, se
 * guarda `profiles.suggested_level` y la app pregunta al usuario si quiere
 * cambiarlo. El nivel nunca cambia solo.»
 *
 * Función pura para poder probarla sin base de datos. Los tres briefs
 * consecutivos son el que se acaba de aplicar más las dos entradas más
 * recientes de `coaching_brief_history` (que `apply_brief` acaba de rellenar
 * con el brief anterior, así que ese histórico ya está actualizado cuando se
 * evalúa esta regla).
 */
import type { Level } from '../../db/schema.js';

/** Cuántos briefs anteriores deben coincidir, además del recién aplicado. */
export const CONSECUTIVE_PREVIOUS_HINTS = 2;

export interface LevelRuleInput {
  /** `level_hint` del brief recién aplicado. */
  readonly appliedLevelHint: Level | null;
  /**
   * `level_hint` de las entradas más recientes de `coaching_brief_history`,
   * de la más nueva a la más vieja. Se usan las dos primeras.
   */
  readonly previousLevelHints: readonly (Level | null)[];
  /** `profiles.level` actual del usuario. */
  readonly profileLevel: Level;
  /** `profiles.suggested_level` actual, para no reescribir lo mismo. */
  readonly currentSuggestedLevel: Level | null;
}

/**
 * Devuelve el nivel que hay que escribir en `profiles.suggested_level`, o
 * `null` si no hay nada que hacer.
 *
 * Si la regla no se cumple **no** se borra un `suggested_level` anterior: la
 * sugerencia sigue pendiente de respuesta del usuario hasta que él la acepte o
 * la descarte (ver PEND-06 de docs/specs/pendientes/PR-05.md).
 */
export function levelToSuggest(input: LevelRuleInput): Level | null {
  const hint = input.appliedLevelHint;
  if (hint === null) return null;
  if (hint === input.profileLevel) return null;

  const previous = input.previousLevelHints.slice(0, CONSECUTIVE_PREVIOUS_HINTS);
  if (previous.length < CONSECUTIVE_PREVIOUS_HINTS) return null;
  if (!previous.every((value) => value === hint)) return null;

  if (input.currentSuggestedLevel === hint) return null;

  return hint;
}
