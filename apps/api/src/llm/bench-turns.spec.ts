/**
 * Comprueba los 20 turnos sintéticos del banco de pruebas (SPEC-03 §9) sin llamar a
 * ningún proveedor. El script `scripts/bench-models.ts` lo ejecuta el operador con
 * sus propias claves.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { SessionKind } from './config.js';
import { buildTurnMessages } from './prompts/index.js';
import { CATEGORIES, type Category } from './schemas.js';

interface BenchTurn {
  id: string;
  kind: SessionKind;
  topic: string;
  history: Array<{ role: 'user' | 'tutor'; text: string }>;
  userMessage: string;
  planted: Array<{ category: Category; trigger: string }>;
}

const turns = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../fixtures/bench/turns.json', import.meta.url)), 'utf-8'),
) as BenchTurn[];

describe('fixtures/bench/turns.json', () => {
  it('tiene 20 turnos con id único', () => {
    expect(turns).toHaveLength(20);
    expect(new Set(turns.map((t) => t.id)).size).toBe(20);
  });

  it('cada turno planta exactamente 2 errores de categorías distintas del catálogo', () => {
    for (const turn of turns) {
      expect(turn.planted).toHaveLength(2);
      for (const planted of turn.planted) {
        expect(CATEGORIES).toContain(planted.category);
        expect(planted.trigger.length).toBeGreaterThan(0);
      }
      expect(turn.planted[0]?.category).not.toBe(turn.planted[1]?.category);
    }
  });

  it('el fragmento plantado aparece literalmente en el mensaje del aprendiz', () => {
    for (const turn of turns) {
      for (const planted of turn.planted) {
        expect(turn.userMessage.toLowerCase()).toContain(planted.trigger.toLowerCase());
      }
    }
  });

  it('cubre los cuatro kinds de sesión', () => {
    const kinds = new Set(turns.map((t) => t.kind));
    expect([...kinds].sort()).toEqual(['boss', 'free_topic', 'news', 'roleplay']);
  });

  it('cada turno se puede convertir en messages sin perder el mensaje del aprendiz', () => {
    for (const turn of turns) {
      const messages = buildTurnMessages({
        locale: 'es',
        level: 'B1',
        kind: turn.kind,
        topic: turn.topic,
        history: turn.history,
        userMessage: turn.userMessage,
      });
      expect(messages[0]?.role).toBe('system');
      expect(messages.at(-1)).toEqual({ role: 'user', content: turn.userMessage });
    }
  });
});
