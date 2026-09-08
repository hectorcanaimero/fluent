/**
 * Constantes de rate limiting (SPEC-02 §7). Ver `rate-limit.module.ts` para
 * cómo se conectan a `@nestjs/throttler` y `user-throttler.guard.ts` para la
 * clave por usuario.
 */

/** Throttler que se aplica a toda ruta por defecto. */
export const DEFAULT_THROTTLER_NAME = 'default';
/** 60 peticiones por minuto por usuario, SPEC-02 §7. */
export const DEFAULT_THROTTLE_LIMIT = 60;
export const DEFAULT_THROTTLE_TTL_MS = 60_000;

/**
 * Throttler con nombre para `POST /sessions/:id/turns` (SPEC-02 §7: 20
 * peticiones por minuto), que todavía no existe — lo crea PR-04
 * (`docs/tasks/PR-02-auth-y-api.md`, T3: «Ese endpoint lo crea PR-04, no
 * tú»).
 *
 * `@nestjs/throttler` aplica **todos** los throttlers registrados en
 * `ThrottlerModule` a **toda** ruta salvo que se salte explícitamente con
 * `@SkipThrottle({ [name]: true })`, así que registrar `'turns'` con el
 * límite real (20/min) lo aplicaría también a rutas que no son
 * `POST /sessions/:id/turns` y rompería el límite general de 60/min de
 * SPEC-02 §7. Se registra en cambio con un límite por defecto deliberadamente
 * holgado (`TURNS_THROTTLE_DEFAULT_LIMIT`) que nunca debería dispararse por
 * sí solo; PR-04 lo estrecha **solo en su ruta** con el decorador
 * `@Throttle(TURNS_THROTTLE)` exportado más abajo, que sobrescribe el límite
 * de este throttler nombrado para ese handler concreto. Documentado en
 * docs/specs/pendientes/PR-02.md.
 */
export const TURNS_THROTTLER_NAME = 'turns';
export const TURNS_THROTTLE_DEFAULT_LIMIT = 10_000;
export const TURNS_THROTTLE_TTL_MS = 60_000;

/** Límite real de SPEC-02 §7 para `POST /sessions/:id/turns`. */
export const TURNS_THROTTLE_LIMIT = 20;

/**
 * Opciones listas para `@Throttle(TURNS_THROTTLE)` en el controlador de
 * turnos que cree PR-04. Ejemplo:
 *
 * ```ts
 * import { Throttle } from '@nestjs/throttler';
 * import { TURNS_THROTTLE } from '../rate-limit/rate-limit.constants.js';
 *
 * @Throttle(TURNS_THROTTLE)
 * @Post('sessions/:id/turns')
 * createTurn() { … }
 * ```
 */
export const TURNS_THROTTLE = {
  [TURNS_THROTTLER_NAME]: {
    limit: TURNS_THROTTLE_LIMIT,
    ttl: TURNS_THROTTLE_TTL_MS,
  },
} as const;
