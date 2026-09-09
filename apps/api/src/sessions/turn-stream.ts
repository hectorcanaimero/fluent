/**
 * Escritura de la respuesta SSE de `POST /sessions/:id/turns/stream`
 * (SPEC-04 §4, «Streaming (RF-3.8, P1)»).
 *
 * Es lo **único** que este endpoint no comparte con `POST /sessions/:id/turns`:
 * el turno entero (validación, lock, ritmo, historial, prompt, persistencia,
 * correcciones, contadores y degradación) lo resuelve el mismo
 * `TurnsService.addTurn`; aquí solo se decide cómo se escribe la respuesta.
 *
 * Función pura respecto de NestJS: recibe la respuesta cruda (lo mínimo que
 * hace falta de `express.Response`) y la función que ejecuta el turno, así que
 * se puede probar con un doble sin levantar la aplicación.
 *
 * ## Formato (ninguna spec lo fija; ver PEND-54)
 *
 * ```text
 * event: token
 * data: {"text":"Nice"}
 *
 * event: corrections
 * data: {"corrections":[{"original":"…","corrected":"…","category":"past_simple","note":"…"}]}
 *
 * event: done
 * data: {"turnIdx":3,"reply":"…","corrections":[…],"modelUsed":"…","degraded":false}
 * ```
 *
 * - `done` lleva **el mismo cuerpo** que devuelve el endpoint no streaming
 *   (`TurnResultDto`), así que la app puede tratarlo como la fuente de verdad
 *   y descartar los tokens que hubiera pintado (necesario, por ejemplo, si los
 *   tokens vinieron de un intento de la cadena de fallback que luego falló y
 *   respondió el siguiente modelo).
 * - Si no se emitió **ningún** token (respuesta degradada de SPEC-03 §6, o
 *   parser incremental fallido, o un proveedor que mandó todo el JSON en el
 *   último trozo), se emite el `reply` completo como un único `token` antes de
 *   `corrections`. Eso es exactamente lo que pide SPEC-04 §4 con «si el parser
 *   falla, cae al modo no streaming de forma transparente para la app»: la app
 *   recibe siempre el texto por `token` y siempre el resultado completo por
 *   `done`, sin tener que saber si hubo streaming de verdad o no.
 * - Un error **antes** del primer token sale como respuesta JSON normal
 *   (SPEC-02 §6): las cabeceras SSE no se escriben hasta el primer `token`, y
 *   como toda la validación (403/409/429/400) ocurre antes de llamar al
 *   modelo, la excepción se propaga al filtro global tal cual.
 * - Un error **después** del primer token ya no puede cambiar el status HTTP:
 *   sale como evento `error` con el mismo cuerpo de SPEC-02 §6 y se cierra el
 *   stream.
 */
import { API_ERROR_STATUS, ApiException, type ApiErrorBody } from '../common/api-error.js';
import type { TurnResultDto } from './sessions.types.js';

/** Nombres de los eventos SSE (SPEC-04 §4 más `error`, ver PEND-55). */
export const TURN_STREAM_EVENTS = Object.freeze({
  token: 'token',
  corrections: 'corrections',
  done: 'done',
  error: 'error',
} as const);

/**
 * Cabeceras de la respuesta SSE. `X-Accel-Buffering: no` desactiva el búfer de
 * nginx (si no, los tokens llegarían a la app de golpe al cerrar el stream).
 */
export const SSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
});

/**
 * Mensaje del evento `error` cuando la excepción no es una `ApiException`.
 * Español fijo, igual que el resto del módulo (PEND-29/PEND-43 de PR-02), y
 * **nunca** el mensaje original: al contrario que el filtro global, que fuera
 * de producción sí lo deja pasar para depurar, aquí no hay forma de saber si
 * estamos en producción sin arrastrar el `ConfigService` hasta una función
 * pura, así que se elige siempre la opción segura.
 */
const INTERNAL_ERROR_MESSAGE = 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.';

/** Lo mínimo de `express.Response` que necesita el stream. */
export interface SseResponse {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}

/** Ejecuta el turno y escribe su resultado como SSE. */
export async function runTurnStream(
  res: SseResponse,
  runTurn: (onToken: (delta: string) => void) => Promise<TurnResultDto>,
): Promise<void> {
  let headersSent = false;

  const start = (): void => {
    if (headersSent) return;
    headersSent = true;
    for (const [name, value] of Object.entries(SSE_HEADERS)) {
      res.setHeader(name, value);
    }
    // Sin esto las cabeceras no salen hasta el primer `flush` de Express y el
    // cliente se queda esperando la respuesta.
    res.flushHeaders?.();
  };

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onToken = (delta: string): void => {
    if (delta === '') return;
    start();
    send(TURN_STREAM_EVENTS.token, { text: delta });
  };

  let result: TurnResultDto;
  try {
    result = await runTurn(onToken);
  } catch (error) {
    if (!headersSent) {
      // Todavía no se ha escrito nada: el filtro global responde con el JSON
      // de SPEC-02 §6 y el status que toque (403/409/429/400/500).
      throw error;
    }
    // Ya hay cabeceras `200 text/event-stream`: el error viaja como evento.
    closeWith(res, () => send(TURN_STREAM_EVENTS.error, toErrorBody(error)));
    return;
  }

  const streamed = headersSent;
  closeWith(res, () => {
    start();
    if (!streamed) {
      // Ningún token: se manda el `reply` entero de una vez (ver cabecera).
      send(TURN_STREAM_EVENTS.token, { text: result.reply });
    }
    send(TURN_STREAM_EVENTS.corrections, { corrections: result.corrections });
    send(TURN_STREAM_EVENTS.done, result);
  });
}

/**
 * Escribe y cierra. Un fallo de escritura (el cliente colgó a mitad del turno)
 * no puede propagarse: el turno ya está persistido y la respuesta ya tiene un
 * `200` escrito, así que no hay nada que informar por HTTP.
 */
function closeWith(res: SseResponse, write: () => void): void {
  try {
    write();
  } catch {
    // El cliente cerró la conexión antes de tiempo.
  }
  try {
    res.end();
  } catch {
    // Idem.
  }
}

/** Cuerpo de SPEC-02 §6 para el evento `error`. */
export function toErrorBody(error: unknown): ApiErrorBody & Record<string, unknown> {
  if (error instanceof ApiException) {
    return error.getApiBody();
  }
  return {
    error: 'INTERNAL',
    message: INTERNAL_ERROR_MESSAGE,
    statusCode: API_ERROR_STATUS.INTERNAL,
  };
}
