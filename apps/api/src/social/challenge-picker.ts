import {
  CHALLENGE_SESSION_LOOKBACK_DAYS,
  CHALLENGE_TOPIC_COOLDOWN_DAYS,
  MAX_CHALLENGES,
} from '../config/product.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sesión candidata a desafío (`GET /challenges`, SPEC-07 §7), sin filtrar todavía. */
export interface CandidateSession {
  readonly sessionId: string;
  readonly userId: string; // el miembro dueño de la sesión (posible `fromUserId`)
  readonly displayName: string;
  readonly topic: string;
  readonly kind: string;
  readonly endedAt: string | null; // ISO 8601, o null si no está cerrada
  readonly xpEarned: number;
}

/** Elemento de `GET /challenges` (SPEC-02 §4.5, `{items: []}`). */
export interface ChallengeCandidate {
  readonly fromUserId: string;
  readonly displayName: string;
  readonly topic: string;
  readonly kind: string;
  readonly sessionId: string;
}

export interface PickChallengesParams {
  /** El usuario que pide `GET /challenges`: nunca puede recibir un desafío de su propia sesión. */
  readonly requestingUserId: string;
  /** Temas que el usuario ya practicó en los últimos `CHALLENGE_TOPIC_COOLDOWN_DAYS` días. */
  readonly practicedTopics: ReadonlySet<string>;
  readonly now: Date;
  readonly sessionLookbackDays?: number;
  readonly maxChallenges?: number;
}

/**
 * Reglas de `GET /challenges` (SPEC-07 §7), como función pura para poder
 * testearlas sin red ni base de datos (criterio de aceptación de T7):
 *
 * - Excluye las sesiones del propio usuario (`requestingUserId`).
 * - Excluye sesiones sin XP (`xpEarned <= 0`) — no son "válidas".
 * - Excluye sesiones cerradas hace más de `sessionLookbackDays` (7 por
 *   defecto, SPEC-07 §7) o sin `endedAt`.
 * - Excluye temas que el usuario ya practicó en la ventana de
 *   `practicedTopics` (14 días, SPEC-07 §7).
 * - Un desafío por miembro: de las sesiones que sobreviven los filtros de
 *   arriba, se toma la más reciente (`endedAt` desc) de cada `userId`.
 * - Máximo `maxChallenges` (3 por defecto, SPEC-07 §7): de los candidatos
 *   restantes (uno por miembro), se toman los más recientes; el desempate,
 *   sin que ninguna spec lo fije, es por `userId` ascendente (determinista),
 *   igual criterio de "menor user_id" que usa `weekly_leaderboard`
 *   (SPEC-07 §5) para sus empates.
 *
 * `sessions.challenge_from_user_id` (que usa `POST /sessions` al aceptar un
 * desafío, y `close_session` para el bono de XP) no se toca aquí: eso es
 * abrir sesión, fuera del alcance de `GET /challenges`.
 */
export function pickChallenges(
  candidateSessions: readonly CandidateSession[],
  params: PickChallengesParams,
): ChallengeCandidate[] {
  const sessionLookbackDays = params.sessionLookbackDays ?? CHALLENGE_SESSION_LOOKBACK_DAYS;
  const maxChallenges = params.maxChallenges ?? MAX_CHALLENGES;
  const cutoffMs = params.now.getTime() - sessionLookbackDays * DAY_MS;

  const eligible = candidateSessions.filter((session) => {
    if (session.userId === params.requestingUserId) return false;
    if (session.xpEarned <= 0) return false;
    if (!session.endedAt) return false;
    const endedAtMs = new Date(session.endedAt).getTime();
    if (Number.isNaN(endedAtMs) || endedAtMs < cutoffMs) return false;
    if (params.practicedTopics.has(session.topic)) return false;
    return true;
  });

  // Más reciente primero, así el primer encuentro por `userId` es "la más
  // reciente de ese miembro".
  const sortedByRecency = [...eligible].sort((a, b) =>
    (b.endedAt ?? '').localeCompare(a.endedAt ?? ''),
  );

  const oneByMember = new Map<string, CandidateSession>();
  for (const session of sortedByRecency) {
    if (!oneByMember.has(session.userId)) {
      oneByMember.set(session.userId, session);
    }
  }

  return [...oneByMember.values()]
    .sort((a, b) => {
      const byRecency = (b.endedAt ?? '').localeCompare(a.endedAt ?? '');
      return byRecency !== 0 ? byRecency : a.userId.localeCompare(b.userId);
    })
    .slice(0, maxChallenges)
    .map((session) => ({
      fromUserId: session.userId,
      displayName: session.displayName,
      topic: session.topic,
      kind: session.kind,
      sessionId: session.sessionId,
    }));
}

/** Ventana de "ya practicado" (SPEC-07 §7), reexportada para el servicio. */
export { CHALLENGE_TOPIC_COOLDOWN_DAYS, CHALLENGE_SESSION_LOOKBACK_DAYS, MAX_CHALLENGES };
