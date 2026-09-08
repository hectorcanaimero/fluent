import { Injectable } from '@nestjs/common';
import {
  ChallengesService as GameChallengesService,
  type ChallengeCandidateSession,
  type ChallengesRepository,
} from '../game/challenges.service.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { GroupAccessService } from './group-access.service.js';
import type { ChallengesResultDto } from './social.types.js';

/**
 * `GET /challenges` (SPEC-07 §7, RF-6.4). Sin LLM.
 *
 * Adaptador delgado sobre `ChallengesService` de
 * `src/game/challenges.service.ts` (PR-07/T2), que es quien aplica las reglas
 * de SPEC-07 §7 (ventana de 7 días, cooldown de 14 días por tema, un desafío
 * por miembro, máximo 3). Este PR aporta lo que su comentario encargaba a
 * «PR-02/T7»: el acceso al grupo, el `ChallengesRepository` contra InsForge y
 * el envoltorio `{items}` que espera la app.
 *
 * Antes de fusionar PR-07 esta clase tenía su propia copia de esas reglas en
 * `challenge-picker.ts`, documentado como PEND-53; ese archivo se borró (ver
 * docs/specs/pendientes/PR-02.md PEND-71).
 *
 * **Limitación conocida, documentada en vez de inventada**: SPEC-07 §7 dice
 * «un desafío por miembro **por semana**», pero no hay ninguna tabla que
 * registre "ya se ofreció este desafío esta semana" — la única fuente es
 * `sessions` (lo que el usuario ya jugó, no lo que se le ofreció). Sin esa
 * tabla, `GET /challenges` es **idempotente por petición** (mismos datos →
 * mismo resultado) pero puede repetir el mismo desafío en llamadas sucesivas
 * de la misma semana si el candidato no cambia.
 */
@Injectable()
export class ChallengesService {
  constructor(
    private readonly groupAccess: GroupAccessService,
    private readonly groupsRepository: GroupsRepository,
    private readonly sessionsQuery: SessionsQueryRepository,
  ) {}

  async listChallenges(
    userId: string,
    acceptLanguageHeader?: string,
    now: Date = new Date(),
  ): Promise<ChallengesResultDto> {
    const { group } = await this.groupAccess.requireOwnGroup(userId, acceptLanguageHeader);

    const members = (await this.groupsRepository.listMembers(group.id)).filter(
      (member) => member.user_id !== userId,
    );
    if (members.length === 0) {
      return { items: [] };
    }

    const candidates = await new GameChallengesService(
      this.repositoryFor(members),
    ).listFor(userId, now);

    // Se recorta `endedAt`: ordena los candidatos en `src/game/`, pero SPEC-02
    // §4.5 no lo incluye en la respuesta.
    return {
      items: candidates.map((candidate) => ({
        fromUserId: candidate.fromUserId,
        displayName: candidate.displayName,
        topic: candidate.topic,
        kind: candidate.kind,
        sessionId: candidate.sessionId,
      })),
    };
  }

  /**
   * `ChallengesRepository` de `src/game/` construido para **este** grupo: las
   * consultas necesitan la lista de miembros, que solo se conoce ya dentro de
   * la petición, así que el adaptador se crea por llamada en vez de ser un
   * provider de Nest (mismo patrón que `LeaderboardService`).
   *
   * Aquí es donde se aplica la definición de "sesión válida" de SPEC-07 §2
   * (`status = 'ended' AND xp_earned > 0`, con `ended_at` no nulo) que la
   * interfaz de `src/game/` da por hecha: `listCandidateSessionsForMembers`
   * trae también las sesiones sin XP para que el filtro se vea en un solo
   * sitio.
   */
  private repositoryFor(
    members: readonly { user_id: string; display_name: string }[],
  ): ChallengesRepository {
    const displayNameByUserId = new Map(
      members.map((member) => [member.user_id, member.display_name]),
    );
    const memberIds = [...displayNameByUserId.keys()];

    return {
      listLatestSessionsByGroupMember: async (
        _userId: string,
        sinceIso: string,
      ): Promise<ChallengeCandidateSession[]> => {
        const rows = await this.sessionsQuery.listCandidateSessionsForMembers(
          memberIds,
          sinceIso,
        );

        return rows
          .filter((row) => row.xp_earned > 0 && row.ended_at !== null)
          .map((row) => ({
            sessionId: row.id,
            userId: row.user_id,
            displayName: displayNameByUserId.get(row.user_id) ?? '',
            kind: row.kind,
            topic: row.topic,
            endedAt: row.ended_at as string,
          }));
      },

      recentTopics: (topicsUserId: string, sinceIso: string) =>
        this.sessionsQuery.listTopicsSince(topicsUserId, sinceIso),
    };
  }
}
