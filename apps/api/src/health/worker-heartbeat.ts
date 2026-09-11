/**
 * Latido del worker en Redis (MEJ-27).
 *
 * El worker no expone HTTP, así que el HEALTHCHECK del contenedor solo podía
 * mirar si el proceso existía (`pgrep -f dist/worker.js`). Eso da por sano un
 * worker con las colas caídas, con el bucle bloqueado o atascado en un job:
 * el proceso sigue ahí. Con una marca que caduca, dejar de trabajar se nota.
 *
 * El TTL es el triple del intervalo de escritura: hacen falta tres latidos
 * perdidos seguidos para declararlo enfermo, así que un pico de carga o un
 * corte breve de Redis no provocan un reinicio.
 */

/** Clave de Redis donde el worker deja su último latido. */
export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';

/** Cada cuánto late el worker. */
export const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;

/** Cuánto vive la marca sin refrescarse. */
export const WORKER_HEARTBEAT_TTL_SECONDS = 90;
