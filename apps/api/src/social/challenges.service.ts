import { Injectable } from '@nestjs/common';
import { CHALLENGE_TOPIC_COOLDOWN_DAYS } from '../config/product.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { SessionsQueryRepository } from '../sessions-query/sessions-query.repository.js';
import { CHALLENGE_SESSION_LOOKBACK_DAYS, pickChallenges, type CandidateSession } from './challenge-picker.js';
import { GroupAccessService } from './group-access.service.js';
import type { ChallengesResultDto } from './social.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `GET /challenges` (SPEC-07 §7, RF-6.4). Sin LLM.
 *
 * **AVISO para PR-07/T2** (docs/specs/pendientes/PR-02.md): esta clase es lo
 * que el alcance de PR-07/T2 describe como `ChallengesService.listFor`.
 * PR-07/T2 no estaba fusionado cuando T7 lo necesitó; **debe adoptar esta
 * clase** (y la función pura `pickChallenges` de `challenge-picker.ts`, y
 * `sessions-query/sessions-query.repository.ts`) en vez de duplicarlas. La
 * columna `sessions.challenge_from_user_id` que menciona su alcance ya
 * existe desde PR-01 (`docs/specs/pendientes/PR-01.md` §13, se adelantó
 * ahí); no hace falta ninguna migración nueva para esto.
 *
 * **Limitación conocida, documentada en vez de inventada** (alcance de T7,
 * punto 3): SPEC-07 §7 dice «un desafío por miembro **por semana**», pero no
 * hay ninguna tabla que registre "ya se ofreció este desafío esta semana" —
 * la única fuente es `sessions` (lo que el usuario ya jugó, no lo que se le
 * ofreció). Sin esa tabla, `GET /challenges` es **idempotente por petición**
 * (mismos datos → mismo resultado) pero puede repetir el mismo desafío en
 * llamadas sucesivas de la misma semana si el candidato no cambia; no hay
 * forma de "descartar" un desafío ofrecido sin aceptarlo. Se documenta como
 * hueco en vez de inventar una tabla fuera del alcance de T7.
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

    const memberIds = members.map((member) => member.user_id);
    const sevenDaysAgoIso = new Date(now.getTime() - CHALLENGE_SESSION_LOOKBACK_DAYS * DAY_MS).toISOString();
    const fourteenDaysAgoIso = new Date(
      now.getTime() - CHALLENGE_TOPIC_COOLDOWN_DAYS * DAY_MS,
    ).toISOString();

    const [candidateRows, practicedTopics] = await Promise.all([
      this.sessionsQuery.listCandidateSessionsForMembers(memberIds, sevenDaysAgoIso),
      this.sessionsQuery.listTopicsSince(userId, fourteenDaysAgoIso),
    ]);

    const displayNameByUserId = new Map(members.map((member) => [member.user_id, member.display_name]));

    const candidates: CandidateSession[] = candidateRows.map((row) => ({
      sessionId: row.id,
      userId: row.user_id,
      displayName: displayNameByUserId.get(row.user_id) ?? '',
      topic: row.topic,
      kind: row.kind,
      endedAt: row.ended_at,
      xpEarned: row.xp_earned,
    }));

    const items = pickChallenges(candidates, {
      requestingUserId: userId,
      practicedTopics,
      now,
    });

    return { items };
  }
}
