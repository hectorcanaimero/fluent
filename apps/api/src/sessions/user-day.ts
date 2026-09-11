/**
 * Día y medianoche del usuario en su propia zona horaria (MAL-23).
 *
 * El tope diario de turnos se cuenta por día natural **del aprendiz**, no en
 * UTC: alguien en Buenos Aires que practica a las 22:00 no debería ver cómo
 * su cupo se reinicia a las 21:00 de su tarde. `profiles.timezone` guarda una
 * zona IANA, así que todo sale de `Intl`, sin dependencias.
 */

/** Fallback cuando el perfil trae una zona que `Intl` no reconoce. */
const FALLBACK_TIMEZONE = 'UTC';

function partsIn(timeZone: string, at: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return Object.fromEntries(
    formatter.formatToParts(at).map((part) => [part.type, part.value]),
  );
}

/** ¿`Intl` reconoce esta zona horaria? */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Zona del perfil si es usable, `UTC` si no. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIMEZONE;
}

/** Día natural del usuario en formato `YYYY-MM-DD`. */
export function userDay(timeZone: string | null | undefined, at: Date = new Date()): string {
  const parts = partsIn(safeTimeZone(timeZone), at);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Segundos que faltan para la próxima medianoche del usuario, al menos 1.
 *
 * Se calcula restando la hora local de las 24 h en vez de construir una fecha
 * en esa zona: así no hay que resolver el desfase UTC ni preocuparse por los
 * cambios de horario de verano, que como mucho desplazan el resultado una
 * hora en los dos días del año en que ocurren.
 */
export function secondsUntilUserMidnight(
  timeZone: string | null | undefined,
  at: Date = new Date(),
): number {
  const parts = partsIn(safeTimeZone(timeZone), at);
  const elapsed =
    Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return Math.max(1, 24 * 3600 - elapsed);
}

/**
 * Instante UTC en el que empezó el día natural del usuario.
 *
 * Se calcula restando el tiempo transcurrido hoy en su zona, por el mismo
 * motivo que [secondsUntilUserMidnight]: así no hay que resolver el desfase
 * UTC ni tratar los cambios de horario de verano a mano.
 */
export function startOfUserDay(
  timeZone: string | null | undefined,
  at: Date = new Date(),
): Date {
  const elapsedSeconds = 24 * 3600 - secondsUntilUserMidnight(timeZone, at);
  return new Date(at.getTime() - elapsedSeconds * 1000);
}

/** Clave del contador diario de turnos de un usuario. */
export function turnsDayKey(userId: string, day: string): string {
  return `turns:day:${userId}:${day}`;
}
