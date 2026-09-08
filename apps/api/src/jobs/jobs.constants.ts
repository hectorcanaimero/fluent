/**
 * Nombres de colas, de jobs y opciones por defecto (SPEC-05 §1).
 *
 * Un único sitio para los literales que comparten la API (que encola) y el
 * worker (que consume), de forma que T2 a T4 de PR-05 no tengan que
 * reinventarlos.
 */
import type { DefaultJobOptions } from 'bullmq';

/* ============================================================================
   Colas (SPEC-05 §1)
   ========================================================================== */

export const QUEUE_BRIEF = 'brief';
export const QUEUE_CONTENT = 'content';
export const QUEUE_SOCIAL = 'social';
export const QUEUE_MAINTENANCE = 'maintenance';

export const QUEUE_NAMES = [
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_SOCIAL,
  QUEUE_MAINTENANCE,
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

/**
 * SPEC-05 §1: «Prefijo de claves `fluent:`».
 *
 * En BullMQ el prefijo es la opción `prefix` de `Queue`/`Worker` y la propia
 * librería añade los dos puntos (`fluent:brief:id`), así que aquí va sin ellos.
 */
export const BULL_PREFIX = 'fluent';

/* ============================================================================
   Nombres de job (SPEC-05 §1)
   ========================================================================== */

/** Cola `brief` · disparado por `POST /sessions/:id/end` (PR-04/T3). */
export const JOB_COACHING_BRIEF = 'coaching-brief';
/** Cola `content` · cron diario 06:00 UTC (PR-05/T2). */
export const JOB_RSS_INGEST = 'rss-ingest';
/** Cola `social` · cron lunes 07:00 UTC (PR-05/T3). */
export const JOB_WEEKLY_SUMMARY = 'weekly-summary';
/** Cola `maintenance` · cron cada minuto (PR-05/T4). */
export const JOB_SESSION_SWEEPER = 'session-sweeper';
/** Cola `maintenance` · cron diario 03:30 UTC (PR-05/T4). */
export const JOB_DAILY_STREAKS = 'daily-streaks';
/** Cola `maintenance` · cron diario 04:00 UTC (PR-05/T4). */
export const JOB_RETENTION = 'retention';
/** Cola `maintenance` · cron cada 6 h (PR-05/T4). */
export const JOB_MODEL_CATALOG = 'model-catalog';

/* ============================================================================
   Concurrencia por cola (SPEC-05 §1)
   La concurrencia es una opción del `Worker`, no de la `Queue`: se aplica en
   el `@Processor(cola, { concurrency })` correspondiente.
   ========================================================================== */

export const QUEUE_CONCURRENCY: Readonly<Record<QueueName, number>> =
  Object.freeze({
    [QUEUE_BRIEF]: 3,
    [QUEUE_CONTENT]: 1,
    [QUEUE_SOCIAL]: 1,
    [QUEUE_MAINTENANCE]: 1,
  });

/* ============================================================================
   Reintentos y backoff por cola (SPEC-05 §1)
   ========================================================================== */

/**
 * `attempts` es el total de intentos, no de reintentos: SPEC-05 §2 dice
 * «tras 3 fallos queda `failed`» para la cola `brief`, así que la columna
 * «Reintentos» de la tabla de §1 se lee como intentos totales de BullMQ.
 *
 * La cola `maintenance` mezcla jobs con políticas distintas (sweeper 0,
 * streaks y retención 1, catálogo 2), así que su valor por defecto es el más
 * conservador (1 intento, sin reintento) y PR-05/T4 sobreescribe `attempts`
 * al encolar cada cron. Ver PEND-05 de `docs/specs/pendientes/PR-05.md`.
 *
 * `removeOnComplete`/`removeOnFail` no están en la spec: se acotan para que
 * el keyspace no crezca sin límite, dejando margen suficiente para el
 * `getJobCounts` de SPEC-05 §9 (PR-05/T5).
 */
export const QUEUE_DEFAULT_JOB_OPTIONS: Readonly<
  Record<QueueName, DefaultJobOptions>
> = Object.freeze({
  [QUEUE_BRIEF]: Object.freeze({
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }),
  [QUEUE_CONTENT]: Object.freeze({
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }),
  [QUEUE_SOCIAL]: Object.freeze({
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }),
  [QUEUE_MAINTENANCE]: Object.freeze({
    attempts: 1,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }),
});
