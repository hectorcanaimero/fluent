/**
 * Timeouts del servidor HTTP de Node, pensados para vivir detrás del proxy
 * de Coolify (Traefik).
 *
 * Node cierra por defecto las conexiones ociosas a los 5 s. Si el proxy
 * reutiliza una conexión del pool justo en esa ventana, la petición muere
 * con un 502 y el turno en curso se pierde. La receta habitual es que el
 * `keepAliveTimeout` del backend sea **mayor** que el del proxy (60 s en
 * Traefik) y que `headersTimeout` lo supere a su vez, porque Node empieza a
 * contar los headers antes de tener la primera línea de la petición.
 *
 * Ver docs/auditoria/2026-09-11-peine-fino.md (MAL-21).
 */
export const KEEP_ALIVE_TIMEOUT_MS = 65_000;
export const HEADERS_TIMEOUT_MS = 66_000;

/** Forma mínima del `http.Server` que se configura aquí. */
export type ConfigurableHttpServer = {
  keepAliveTimeout: number;
  headersTimeout: number;
};

export function configureHttpServer<T extends ConfigurableHttpServer>(server: T): T {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  return server;
}
