import { XP_LEVELS } from '../config/product.js';

/** `level` de `GET /progress` (SPEC-02 §4.5, SPEC-07 §1). */
export interface LevelInfo {
  readonly name: string;
  readonly min: number;
  /** `minXp` del siguiente nivel, o `null` en el último (`Native-ish`). */
  readonly next: number | null;
}

/**
 * Nivel de XP (SPEC-07 §1, `XP_LEVELS` de `config/product.ts`, nunca
 * hardcodeado aquí). Función pura: se prueba en los límites exactos
 * (0, 499, 500, 1499, 1500, 3499, 3500, 6999, 7000 y por encima,
 * docs/specs/pendientes/PR-02.md).
 *
 * `XP_LEVELS` está ordenado ascendente por `minXp`; se toma el último nivel
 * cuyo `minXp` no supera `xp`.
 */
export function levelFor(xp: number): LevelInfo {
  let currentIndex = 0;
  for (let i = 0; i < XP_LEVELS.length; i += 1) {
    if (xp >= XP_LEVELS[i].minXp) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const current = XP_LEVELS[currentIndex];
  const next = XP_LEVELS[currentIndex + 1];

  return {
    name: current.name,
    min: current.minXp,
    next: next ? next.minXp : null,
  };
}
