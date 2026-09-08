/**
 * Boss battle (SPEC-07 §4; docs/tasks/PR-07-gamificacion-y-social.md T3).
 *
 * Clase pura, sin `@Injectable` ni módulo de NestJS: sigue el mismo patrón que
 * `ProgressService` y `ChallengesService` (apps/api/src/game/). El repositorio
 * de temas usados se recibe por constructor como una interfaz; PR-02/T7
 * implementará `BossRepository` contra InsForge (tabla `sessions`). El
 * registro de rechazo diario tampoco toca `ioredis` directamente: recibe una
 * interfaz mínima (`BossSkipStore`), igual que `CacheStore` en
 * `apps/api/src/llm/catalog.service.ts`; PR-02/T7 la implementará contra
 * `REDIS_CACHE_CLIENT` (apps/api/src/redis/) con la clave
 * `boss:skip:<user>:<día>` que pide la tarea. Los tests usan implementaciones
 * en memoria (ver boss.service.spec.ts).
 *
 * Discrepancia SPEC-07 §4 vs. criterio de aceptación de la tarea, y demás
 * decisiones sin spec: ver docs/specs/pendientes/PR-07.md, sección "T3".
 */
import type { BossTopic } from '../content/index.js';
import { BOSS_TOPICS } from '../content/index.js';
import type { Level } from '../db/schema.js';
import { BOSS_EVERY_N_SESSIONS } from '../config/product.js';
import { isoDateString } from './iso-week.js';

/** Orden de niveles CEFR usados por la app, local a este archivo (ver pendientes). */
const LEVEL_ORDER: readonly Level[] = ['A2', 'B1', 'B2'];

/**
 * Repositorio simulado que necesita `BossService` para saber qué temas de
 * `BOSS_TOPICS` ya usó un usuario. PR-02/T7 implementará esta interfaz contra
 * InsForge con el cliente admin; en tests se usa una implementación en
 * memoria (ver boss.service.spec.ts).
 */
export interface BossRepository {
  /**
   * IDs de `BOSS_TOPICS` que `userId` ya usó en una sesión `kind = 'boss'`
   * cuyo estado no es `'active'` (es decir, `status IN ('ended',
   * 'abandoned')`). Ver criterio exacto y su justificación en
   * docs/specs/pendientes/PR-07.md.
   */
  getUsedBossTopicIds(userId: string): Promise<ReadonlySet<string>>;
}

/**
 * Almacén mínimo del rechazo diario del boss. Interfaz deliberadamente sin
 * `ioredis` (mismo patrón que `CacheStore` en
 * apps/api/src/llm/catalog.service.ts), para no acoplar `BossService` a
 * Redis directamente. PR-02/T7 la implementará como un `SET` con TTL ~24h
 * bajo la clave `boss:skip:<user>:<día>`.
 */
export interface BossSkipStore {
  /** `true` si `userId` ya rechazó el boss hoy (`day` = `'YYYY-MM-DD'` UTC). */
  wasSkippedToday(userId: string, day: string): Promise<boolean>;
  /** Registra el rechazo de hoy (`day` = `'YYYY-MM-DD'` UTC). */
  recordSkip(userId: string, day: string): Promise<void>;
}

/** Datos de `profiles` que necesita `BossService` para decidir si toca boss. */
export interface BossProfileInput {
  /** `profiles.sessions_count`. */
  readonly sessionsCount: number;
  /** `profiles.level`, para filtrar temas alcanzables por `level_min`. */
  readonly level: Level;
}

/**
 * `true` si la próxima sesión (la que ocuparía el índice `sessionsCount`,
 * es decir la sesión número `sessionsCount + 1`) debe ofrecerse como boss
 * battle (SPEC-07 §4, RF-5.3): `(sessionsCount + 1) % BOSS_EVERY_N_SESSIONS
 * === 0`.
 *
 * Pura: no toca ningún repositorio ni Redis, igual que `levelFor` en
 * progress.service.ts. Usa `BOSS_EVERY_N_SESSIONS` de
 * `apps/api/src/config/product.ts` en vez de hardcodear 7.
 */
export function isBossDue(sessionsCount: number): boolean {
  return (sessionsCount + 1) % BOSS_EVERY_N_SESSIONS === 0;
}

export class BossService {
  constructor(
    private readonly repo: BossRepository,
    private readonly skipStore: BossSkipStore,
  ) {}

  /**
   * `true` si a `userId` corresponde ofrecerle un boss battle en el momento
   * `now` (por defecto, ahora).
   *
   * Primero comprueba `isBossDue(profile.sessionsCount)`: si la sesión no
   * toca boss, devuelve `false` sin consultar `skipStore`. Si toca, consulta
   * si ya se rechazó **hoy** (día calendario UTC de `now`, vía
   * `isoDateString`): si se rechazó hoy, `false`; si no, `true`.
   *
   * Nota sobre la spec: SPEC-07 §4 dice "se vuelve a ofrecer en la siguiente
   * sesión", pero el criterio de aceptación de la tarea T3 exige "tras
   * rechazar hoy no se ofrece hasta mañana" (día calendario, no sesión). Este
   * método sigue el criterio de la tarea — ver discrepancia documentada en
   * docs/specs/pendientes/PR-07.md.
   */
  async isPending(
    userId: string,
    profile: BossProfileInput,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (!isBossDue(profile.sessionsCount)) {
      return false;
    }

    const skippedToday = await this.skipStore.wasSkippedToday(userId, isoDateString(now));
    return !skippedToday;
  }

  /**
   * Elige el tema de boss para `userId` en su `level`, evitando temas que ya
   * usó (según `BossRepository.getUsedBossTopicIds`) y temas fuera de su
   * alcance (`topic.level_min` debe ser `<= level` en `LEVEL_ORDER`).
   *
   * Selección determinista: devuelve el primer tema candidato en el orden en
   * que aparece en `BOSS_TOPICS` (sin aleatoriedad). SPEC-07 §4 no da ninguna
   * señal para priorizar un tema sobre otro; ver justificación y posible
   * mejora futura (barajar o inyectar un selector) en
   * docs/specs/pendientes/PR-07.md.
   *
   * Devuelve `null` si no hay candidatos: todos los temas alcanzables ya
   * están usados, o `level` no tiene ningún tema alcanzable (caso `'A2'`:
   * `BOSS_TOPICS` solo contiene `level_min` `'B1'`/`'B2'`, así que un usuario
   * A2 nunca recibe boss con el contenido actual — ver pendientes).
   */
  async pickTopic(userId: string, level: Level): Promise<BossTopic | null> {
    const used = await this.repo.getUsedBossTopicIds(userId);
    const levelRank = LEVEL_ORDER.indexOf(level);

    const candidate = BOSS_TOPICS.find((topic) => {
      if (used.has(topic.id)) {
        return false;
      }
      const topicRank = LEVEL_ORDER.indexOf(topic.level_min);
      return topicRank <= levelRank;
    });

    return candidate ?? null;
  }

  /**
   * Registra que `userId` rechazó el boss hoy (día calendario UTC de `now`,
   * por defecto ahora). Delega en `skipStore.recordSkip`; no valida que
   * `isPending` fuera `true` antes de llamar (la ruta HTTP, PR-02/T7, decide
   * si vale la pena esa validación adicional).
   */
  async recordSkip(userId: string, now: Date = new Date()): Promise<void> {
    await this.skipStore.recordSkip(userId, isoDateString(now));
  }
}
