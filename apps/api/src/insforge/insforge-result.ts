/**
 * Forma de `error` en el `{ data, error }` que devuelve `@insforge/sdk` para
 * cualquier consulta contra `client.database` (PostgREST/`@supabase/postgrest-js`
 * por debajo): `{ code, message, details, hint }`. Se declara aquí en vez de
 * importarla del SDK porque no la reexporta como tipo público.
 */
export interface PostgrestErrorLike {
  readonly code?: string | null;
  readonly message: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

export interface InsforgeResult<T> {
  readonly data: T | null;
  readonly error: PostgrestErrorLike | null;
}

/** Código de violación de UNIQUE de Postgres (para detectar carreras al insertar). */
export const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Desenvuelve `{ data, error }` de una consulta simple del cliente admin de
 * InsForge (`from(table).select/insert/update/delete`, **no** RPC).
 *
 * Un `error` aquí es un fallo inesperado (conexión, un CHECK que salta por un
 * bug de la API, una columna que ya no existe): nunca es una regla de negocio
 * que el cliente deba entender, así que no se traduce a `ApiException` — se
 * relanza como `Error` genérico y lo formatea el filtro global de errores de
 * PR-02/T3 (500 en producción, sin filtrar detalles).
 *
 * `data === null` sin `error` es un resultado válido (por ejemplo
 * `.maybeSingle()` sin ninguna fila) y se devuelve tal cual; decidir si eso
 * es un error de dominio (perfil inexistente, etc.) es cosa de quien llama.
 */
export function unwrapInsforge<T>(result: InsforgeResult<T>): T | null {
  if (result.error) {
    throw new Error(
      `Error de InsForge: ${result.error.message} (code=${result.error.code ?? '?'})`,
      { cause: result.error },
    );
  }
  return result.data;
}

/**
 * Exige que `unwrapInsforge` (o cualquier lectura que pueda devolver `null`)
 * haya devuelto una fila. Si no, es un bug de la API (por ejemplo, un
 * `UPDATE ... WHERE user_id = $1` sobre un usuario que ya no existe), no un
 * error de dominio para el cliente.
 */
export function requireRow<T>(row: T | null, context: string): T {
  if (row === null) {
    throw new Error(`${context}: se esperaba una fila y no llegó ninguna`);
  }
  return row;
}
