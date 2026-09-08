import type { ZodType } from 'zod';

/**
 * Finds the first balanced `{...}` object in `text` and parses it as JSON.
 *
 * Tolerates:
 * - markdown code fences (```json ... ``` or ``` ... ```)
 * - prose before and/or after the JSON object
 * - braces that appear inside JSON string values (respecting `\"` and `\\` escapes)
 *
 * Does NOT attempt to repair malformed JSON (single quotes, trailing commas, etc).
 * Returns `null` when no balanced object is found or `JSON.parse` fails.
 */
export function extractFirstJsonObject(text: string): unknown | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Si el primer candidato balanceado no es JSON válido (por ejemplo, una llave
  // suelta en la prosa: `Here is {your} answer: {...}`), se prueba con el siguiente.
  let start = text.indexOf('{');
  while (start !== -1) {
    const end = findBalancedEnd(text, start);
    if (end === -1) {
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
      start = text.indexOf('{', start + 1);
    }
  }

  return null;
}

/** Índice de la `}` que cierra la `{` de `start`, o -1 si nunca se equilibra. */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'no_json' | 'schema' };

export function parseWithSchema<T>(
  text: string,
  schema: ZodType<T>,
): ParseResult<T> {
  const json = extractFirstJsonObject(text);
  if (json === null) {
    return { ok: false, reason: 'no_json' };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, reason: 'schema' };
  }

  return { ok: true, data: result.data };
}
