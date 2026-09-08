/**
 * Desafíos cruzados (SPEC-07 §7; docs/tasks/PR-07-gamificacion-y-social.md T2).
 *
 * Clase pura, sin `@Injectable` ni módulo de NestJS: sigue el mismo patrón que
 * `ProgressService` (apps/api/src/game/progress.service.ts) y `LlmService`
 * (apps/api/src/llm/llm.service.ts). El repositorio se recibe por constructor
 * como una interfaz; PR-02/T7 implementará `ChallengesRepository` contra
 * InsForge (vista `group_members` y tabla `sessions`). Los tests usan un
 * repositorio simulado en memoria (ver challenges.service.spec.ts).
 */
import type { SessionKind } from '../db/schema.js';
import {
  CHALLENGE_SESSION_LOOKBACK_DAYS,
  CHALLENGE_TOPIC_COOLDOWN_DAYS,
  MAX_CHALLENGES,
} from '../config/product.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Las tres constantes de SPEC-07 §7 viven en `config/product.ts` (las
// centralizó PR-02/T7); aquí solo se les da un nombre local que se lea bien.
/** Ventana de "los últimos 7 días" para la sesión candidata de cada miembro (SPEC-07 §7). */
const CANDIDATE_WINDOW_DAYS = CHALLENGE_SESSION_LOOKBACK_DAYS;
/** Ventana de "los últimos 14 días" para los topics propios que descartan un candidato (SPEC-07 §7). */
const OWN_TOPICS_WINDOW_DAYS = CHALLENGE_TOPIC_COOLDOWN_DAYS;
/** Máximo de desafíos devueltos (SPEC-07 §7: "Máximo 3"). */
const MAX_CANDIDATES = MAX_CHALLENGES;

/** Sesión válida de un miembro del grupo, candidata a convertirse en desafío. */
export interface ChallengeCandidateSession {
  /** `sessions.id` de la sesión que origina el desafío. */
  readonly sessionId: string;
  /** Miembro del grupo que practicó (nunca el usuario que pide la lista). */
  readonly userId: string;
  /** `profiles.display_name` de ese miembro. */
  readonly displayName: string;
  readonly kind: SessionKind;
  readonly topic: string;
  /** ISO 8601 timestamp (columna `sessions.ended_at`). */
  readonly endedAt: string;
}

/**
 * Repositorio simulado que necesita `ChallengesService`. PR-02/T7 implementará
 * esta interfaz contra InsForge con el cliente admin; en tests se usa una
 * implementación en memoria (ver challenges.service.spec.ts).
 *
 * "Sesión válida" (SPEC-07 §2, mismo criterio que T1/`ProgressRepository`) =
 * fila de `sessions` con `status = 'ended' AND xp_earned > 0`.
 *
 * `sinceIso` en ambos métodos es un timestamp ISO 8601 completo
 * (`Date#toISOString()`), igual que en `ProgressRepository`: así la
 * implementación real filtra directamente `ended_at >= sinceIso` /
 * `created_at >= sinceIso` sin ambigüedad de hora.
 *
 * Diseño: un único método agregado (`listLatestSessionsByGroupMember`) en vez
 * de `listGroupMembers` + `latestValidSession` por miembro (N+1). La vista
 * `group_members` ya expone `group_id`, así que la implementación real puede
 * resolver "última sesión válida por miembro del grupo de `userId`, en la
 * ventana" con una sola consulta agregada (`DISTINCT ON` o `ROW_NUMBER()`
 * particionado por `user_id`), sin una llamada por miembro. Ver decisión
 * documentada en docs/specs/pendientes/PR-07.md.
 */
export interface ChallengesRepository {
  /**
   * Última sesión válida de cada miembro del grupo de `userId` (excluyéndolo
   * a él mismo) con `ended_at >= sinceIso`. Como mucho una fila por miembro:
   * la más reciente dentro de la ventana. Un miembro sin ninguna sesión
   * válida en la ventana simplemente no aparece.
   */
  listLatestSessionsByGroupMember(
    userId: string,
    sinceIso: string,
  ): Promise<ChallengeCandidateSession[]>;

  /**
   * Topics que el propio `userId` practicó desde `sinceIso`.
   *
   * La implementación de PR-02 (`SessionsQueryRepository.listTopicsSince`)
   * cuenta **cualquier** sesión, válida o no, y filtra por `started_at`, no
   * por `ended_at`: haber practicado un tema no depende de que la sesión
   * llegara a dar XP. Decisión documentada en
   * docs/specs/pendientes/PR-02.md (PEND-71 al fusionar).
   */
  recentTopics(userId: string, sinceIso: string): Promise<ReadonlySet<string>>;
}

/**
 * Desafío candidato que devuelve `GET /challenges` (SPEC-07 §7).
 *
 * `sessionId` y `displayName` los añadió PR-02 al fusionar: son parte del
 * contrato que espera la app (`apps/mobile/lib/core/api/models.dart`
 * `ChallengeItem`) y sin ellos el controlador tendría que volver a cruzar los
 * datos por su cuenta. Ver docs/specs/pendientes/PR-02.md PEND-71.
 */
export interface ChallengeCandidate {
  /** Miembro del grupo del que viene el desafío (futuro `sessions.challenge_from_user_id`). */
  readonly fromUserId: string;
  /** Nombre visible de ese miembro. */
  readonly displayName: string;
  readonly kind: SessionKind;
  readonly topic: string;
  /** `sessions.id` de la sesión que originó el desafío. */
  readonly sessionId: string;
  /** `ended_at` de la sesión del miembro que originó el desafío. */
  readonly endedAt: string;
}

export class ChallengesService {
  constructor(private readonly repo: ChallengesRepository) {}

  /**
   * Lista los desafíos disponibles para `userId` en el momento `now` (por
   * defecto, ahora), siguiendo SPEC-07 §7:
   *
   * - Un candidato por miembro del grupo distinto de `userId`: su sesión
   *   válida más reciente de los últimos 7 días.
   * - Se descarta el candidato si su `topic` coincide (comparación exacta de
   *   string) con un topic que `userId` practicó (sesión válida) en los
   *   últimos 14 días.
   * - Miembros sin ninguna sesión válida en los últimos 7 días no aportan
   *   candidato.
   * - Máximo 3 resultados; si hay más de 3 miembros con candidato válido, se
   *   ordenan por `endedAt` descendente (el desafío más reciente primero) y
   *   se recorta a 3 — SPEC-07 §7 no fija el criterio de orden, ver
   *   docs/specs/pendientes/PR-07.md. A igualdad de `endedAt` desempata el
   *   `userId` ascendente, para que el resultado sea determinista (mismo
   *   criterio de "menor user_id" que usa `weekly_leaderboard`); lo añadió
   *   PR-02 al fusionar, ver PEND-71.
   *
   * NO aplica aquí la regla "un desafío por miembro por semana": esa
   * restricción es de PR-04, al crear la sesión con `challengeFromUserId`
   * (`POST /sessions`) — este método solo lista candidatos, no bloquea
   * aceptar el mismo desafío dos veces. Ver pendientes.
   *
   * Filtra defensivamente `session.userId !== userId` aunque el repositorio
   * (vista `group_members`) ya debería excluir al propio usuario, para que un
   * error de implementación del repositorio real no genere un "desafío
   * contra uno mismo". Ver pendientes.
   */
  async listFor(userId: string, now: Date = new Date()): Promise<ChallengeCandidate[]> {
    const candidateSince = new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * MS_PER_DAY);
    const ownTopicsSince = new Date(now.getTime() - OWN_TOPICS_WINDOW_DAYS * MS_PER_DAY);

    const [sessions, recentTopics] = await Promise.all([
      this.repo.listLatestSessionsByGroupMember(userId, candidateSince.toISOString()),
      this.repo.recentTopics(userId, ownTopicsSince.toISOString()),
    ]);

    // Un candidato por miembro: si el repositorio devolviera más de una fila
    // para el mismo `userId` (no debería, pero no se confía ciegamente), se
    // queda con la más reciente.
    const latestByMember = new Map<string, ChallengeCandidateSession>();
    for (const session of sessions) {
      if (session.userId === userId) {
        continue; // defensivo: nunca un desafío contra uno mismo.
      }
      const existing = latestByMember.get(session.userId);
      if (!existing || new Date(session.endedAt).getTime() > new Date(existing.endedAt).getTime()) {
        latestByMember.set(session.userId, session);
      }
    }

    const candidates: ChallengeCandidate[] = Array.from(latestByMember.values())
      .filter((session) => !recentTopics.has(session.topic))
      .map((session) => ({
        fromUserId: session.userId,
        displayName: session.displayName,
        kind: session.kind,
        topic: session.topic,
        sessionId: session.sessionId,
        endedAt: session.endedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime() ||
          a.fromUserId.localeCompare(b.fromUserId),
      );

    return candidates.slice(0, MAX_CANDIDATES);
  }
}
