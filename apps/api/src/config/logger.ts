import type { Params } from 'nestjs-pino';
import type { Env } from './env.js';

/** Ruta (con el prefijo global `v1`) del health check que no se registra. */
const HEALTH_PATH = '/v1/health';

/**
 * Cabeceras que nunca deben acabar en los logs. `pino` las sustituye por
 * `[Redacted]` en vez de borrarlas, así que se sigue viendo que la petición
 * traía credenciales sin exponer su valor.
 *
 * `req.headers.authorization` es el bearer de Insforge (SPEC-02 §4): con
 * `level: debug` —el valor por defecto en desarrollo— `pino-http` serializa
 * la petición entera, cabeceras incluidas, y el token quedaría en claro en
 * los logs de Coolify. Ver docs/auditoria/2026-09-11-peine-fino.md (MAL-17).
 */
const REDACTED_HEADERS = ['req.headers.authorization', 'req.headers.cookie'];

/**
 * Opciones de `pinoHttp` compartidas por la API (`AppModule`) y el worker
 * (`WorkerModule`). Una única función para que las dos configuraciones no
 * se desincronicen: el worker no sirve HTTP hoy, pero hereda el mismo
 * `redact` por si algún día lo hace.
 *
 * `autoLogging.ignore` silencia el health check: Coolify lo consulta cada
 * pocos segundos y, sin esto, ahoga cualquier otra línea de log.
 */
export function buildPinoHttpOptions(env: Pick<Env, 'LOG_LEVEL'>): Params['pinoHttp'] {
  return {
    level: env.LOG_LEVEL,
    redact: REDACTED_HEADERS,
    autoLogging: {
      ignore: (req: { url?: string }) => (req.url ?? '').split('?')[0] === HEALTH_PATH,
    },
  };
}
