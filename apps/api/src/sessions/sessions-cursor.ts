/**
 * Cursor de keyset de `GET /sessions` (SPEC-02 §4.3): sesiones del usuario
 * ordenadas por `started_at` descendente.
 *
 * **Formato elegido** (SPEC-02 §4.3 deja la decisión a esta tarea): el cursor
 * codifica en base64url el JSON `{"s":"<started_at ISO>"}` — el `started_at`
 * de la última fila de la página anterior — y la página siguiente pide
 * `started_at < s`. Es más simple que un keyset con desempate por `id`
 * (que necesitaría un filtro `or(...)` de PostgREST) a costa de un caso
 * límite documentado: dos sesiones del mismo usuario con el **mismo**
 * `started_at` al milisegundo (`timestamptz`, cada sesión nace en su propia
 * transacción) podrían perderse o repetirse en el borde de una página. Con
 * el volumen esperado (una sesión activa por usuario a la vez, SPEC-04 §2)
 * la colisión es prácticamente imposible; ver docs/specs/pendientes/PR-04.md.
 *
 * Puro y sin dependencias de Nest: un cursor corrupto no lanza `ApiException`
 * aquí (eso lo decide quien llama, para que el `400 VALIDATION` lleve el
 * `field` correcto) sino un `Error` genérico que el servicio traduce.
 */

export interface SessionsCursor {
  readonly startedAt: string;
}

/** Cursor a partir de la última fila de una página (`started_at` de esa fila). */
export function encodeSessionsCursor(row: { readonly started_at: string }): string {
  return Buffer.from(JSON.stringify({ s: row.started_at }), 'utf-8').toString('base64url');
}

/** Lanza `Error` si `cursor` no es un JSON `{s: string}` con una fecha ISO válida. */
export function decodeSessionsCursor(cursor: string): SessionsCursor {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    parsed = JSON.parse(json);
  } catch {
    throw new Error('cursor no es un valor codificado válido.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { s?: unknown }).s !== 'string' ||
    Number.isNaN(Date.parse((parsed as { s: string }).s))
  ) {
    throw new Error('cursor no tiene el formato esperado.');
  }

  return { startedAt: (parsed as { s: string }).s };
}
