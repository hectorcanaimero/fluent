import { Module } from '@nestjs/common';
import { GroupsRepository } from '../groups/groups.repository.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { SessionsQueryModule } from '../sessions-query/sessions-query.module.js';
import { ChallengesService } from './challenges.service.js';
import { GroupAccessService } from './group-access.service.js';
import { LeaderboardRepository } from './leaderboard.repository.js';
import { LeaderboardService } from './leaderboard.service.js';
import { SocialController } from './social.controller.js';
import { WeeklySummaryRepository } from './weekly-summary.repository.js';
import { WeeklySummaryService } from './weekly-summary.service.js';

/**
 * Módulo social (SPEC-02 §4.5, SPEC-07 §5/§7/§8, RF-6.x): `GET /leaderboard`,
 * `GET /challenges`, `GET /weekly-summary`.
 *
 * Declara `ProfilesRepository` y `GroupsRepository` como providers propios
 * (además de en `ProfilesModule`/`GroupsModule`/`ProgressModule`): son
 * envoltorios sin estado sobre el cliente admin de InsForge (global), así
 * que repetir la declaración evita una dependencia circular entre módulos
 * sin ganar nada a cambio (mismo patrón documentado en
 * `GroupsModule`/`ProfilesModule`, PR-02/T2).
 */
@Module({
  imports: [SessionsQueryModule],
  controllers: [SocialController],
  providers: [
    ProfilesRepository,
    GroupsRepository,
    GroupAccessService,
    LeaderboardRepository,
    LeaderboardService,
    ChallengesService,
    WeeklySummaryRepository,
    WeeklySummaryService,
  ],
  // `SessionsModule` lo necesita para validar `challengeFromUserId` al abrir
  // una sesión (MAL-19). Se exporta el servicio en vez de duplicarlo allí:
  // arrastra `GroupAccessService` + repositorios y no hay ciclo
  // (`SocialModule` solo importa `SessionsQueryModule`, que es un módulo hoja).
  exports: [ChallengesService],
})
export class SocialModule {}
