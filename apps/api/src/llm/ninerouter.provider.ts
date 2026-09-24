import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Env } from '../config/env.js';

export const NINEROUTER_PROVIDER = Symbol('NINEROUTER_PROVIDER');

export type NineRouterProvider = ReturnType<typeof createOpenAICompatible>;

/**
 * Sin `stream` en el cuerpo 9router responde SSE aunque no se pida, así que
 * se fuerza `stream: false` cuando el SDK no la manda.
 */
const fetchWithStreamDefault: typeof globalThis.fetch = (input, init) => {
  if (typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body && typeof body === 'object' && !('stream' in body)) {
        return globalThis.fetch(input, { ...init, body: JSON.stringify({ ...body, stream: false }) });
      }
    } catch {
      // cuerpo no JSON: se envía tal cual
    }
  }
  return globalThis.fetch(input, init);
};

/** El nombre `'9router'` es la clave de `providerOptions` (p. ej. `reasoningEffort`). */
export function createNineRouterProvider(
  env: Pick<Env, 'NINEROUTER_URL' | 'NINEROUTER_API_KEY'>,
): NineRouterProvider {
  return createOpenAICompatible({
    name: '9router',
    baseURL: env.NINEROUTER_URL,
    apiKey: env.NINEROUTER_API_KEY,
    includeUsage: true,
    fetch: fetchWithStreamDefault,
  });
}
