import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES, type SessionKind } from '../db/schema.js';

/**
 * Repositorio de lectura de `sessions` (SPEC-01 §2.6) compartido por
 * `ProgressModule` (`GET /progress`) y `SocialModule` (`GET /challenges`):
 * las tres consultas que necesitan ambos son proyecciones simples sobre
 * `sessions`, sin invariantes, así que no hace falta una RPC.
 *
 * Es la mitad "datos" de las interfaces `ProgressRepository` y
 * `ChallengesRepository` que declara `src/game/` (PR-07): los adaptadores que
 * las implementan (`progress/progress.repository.ts` y el repositorio por
 * llamada de `social/challenges.service.ts`) se apoyan en estos métodos.
 *
 * Vive en su propio módulo hoja (`SessionsQueryModule`, sin imports propios)
 * para que `ProgressModule` y `SocialModule` lo importen cada uno por su
 * lado sin crear un ciclo entre ellos (mismo patrón que
 * `ProviderFetchModule`, docs/specs/pendientes/PR-02.md PEND-49).
 */
@Injectable()
export class SessionsQueryRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /**
   * Sesiones válidas (`status='ended' AND xp_earned > 0`) del usuario desde
   * `sinceIso`, contadas por `ended_at` (SPEC-07 §2, decisión de
   * `docs/specs/pendientes/PR-01.md` §17: "el día de las sesiones válidas se
   * cuenta por `ended_at`", que es cuando se concedió el XP).
   */
  async countValidSessionsSince(userId: string, sinceIso: string): Promise<number> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .gt('xp_earned', 0)
      .gte('ended_at', sinceIso)
      .limit(SESSIONS_THIS_WEEK_ROW_LIMIT);

    return (unwrapInsforge<{ id: string }[]>(result) ?? []).length;
  }

  /**
   * Temas de **cualquier** sesión (válida o no) del usuario desde `sinceIso`,
   * para decidir si "ya lo practicó" (`GET /challenges`, SPEC-07 §7): se usa
   * `started_at`, no `ended_at`, porque practicar un tema no depende de si
   * la sesión llegó a dar XP (docs/specs/pendientes/PR-02.md).
   */
  async listTopicsSince(userId: string, sinceIso: string): Promise<Set<string>> {
    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('topic')
      .eq('user_id', userId)
      .gte('started_at', sinceIso)
      .limit(TOPICS_SINCE_ROW_LIMIT);

    const rows = unwrapInsforge<{ topic: string }[]>(result) ?? [];
    return new Set(rows.map((row) => row.topic));
  }

  /**
   * Sesiones candidatas a desafío (`GET /challenges`, SPEC-07 §7): de los
   * `userIds` dados (los demás miembros del grupo), sus sesiones `ended`
   * cerradas desde `sinceIso`, más recientes primero. Trae también las que
   * no dieron XP y las `kind`/`ended_at`/`xp_earned`: la regla exacta (válida,
   * dentro de la ventana, tema no practicado, una por miembro, máximo 3) la
   * aplica `ChallengesService` de `src/game/` (PR-07/T2), no esta consulta —
   * así queda testeable sin red ni base de datos.
   */
  async listCandidateSessionsForMembers(
    userIds: readonly string[],
    sinceIso: string,
  ): Promise<CandidateSessionRow[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.admin.database
      .from(TABLES.sessions)
      .select('id, user_id, topic, kind, ended_at, xp_earned')
      .in('user_id', [...userIds])
      .eq('status', 'ended')
      .gte('ended_at', sinceIso)
      .order('ended_at', { ascending: false })
      .limit(CANDIDATE_SESSIONS_ROW_LIMIT);

    return unwrapInsforge<CandidateSessionRow[]>(result) ?? [];
  }
}

export interface CandidateSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly topic: string;
  readonly kind: SessionKind;
  readonly ended_at: string | null;
  readonly xp_earned: number;
}

/**
 * Límites de filas (SPEC-02 §4.5/§7, docs/specs/pendientes/PR-02.md): las
 * tres consultas ya acotan por usuario/grupo y por una ventana corta (7 o 14
 * días), así que estos límites son una red de seguridad generosa, no un
 * recorte esperado en uso normal.
 */
export const SESSIONS_THIS_WEEK_ROW_LIMIT = 200;
export const TOPICS_SINCE_ROW_LIMIT = 500;
export const CANDIDATE_SESSIONS_ROW_LIMIT = 500;
