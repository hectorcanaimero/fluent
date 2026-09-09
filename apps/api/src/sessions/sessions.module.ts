import { Module } from '@nestjs/common';
import { BossService } from '../game/boss.service.js';
import { LlmModule } from '../llm/llm.module.js';
import { InsforgeBossRepository } from './boss.repository.js';
import { RedisBossSkipStore } from './boss-skip.store.js';
import { EndSessionRepository } from './end-session.repository.js';
import { EndSessionService } from './end-session.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsHistoryRepository } from './sessions-history.repository.js';
import { SessionsHistoryService } from './sessions-history.service.js';
import { SESSION_RANDOM } from './sessions.constants.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';
import { SuggestionsRepository } from './suggestions.repository.js';
import { SuggestionsService } from './suggestions.service.js';
import { TurnsRepository } from './turns.repository.js';
import { TurnsService } from './turns.service.js';

/**
 * Módulo de sesión de conversación (SPEC-02 §4.3, SPEC-04). Tras PR-04/T3
 * expone `POST /sessions`, `POST /sessions/:id/turns`, `POST
 * /sessions/:id/end`, `GET /sessions/suggestions`, `GET /sessions` y `GET
 * /sessions/:id`; T4 añade el streaming.
 *
 * - `LlmModule` aporta el `LlmService` ya construido **y** reexporta
 *   `LlmInfraModule` → `CredentialsModule`, de donde sale `CredentialsService`
 *   (`CredentialsSource` de SPEC-03 §2).
 * - `InsforgeModule` (cliente admin) y `RedisModule` (`RedisService`) son
 *   globales, así que no hace falta importarlos.
 * - `BossService` es una clase pura de `src/game/` (sin `@Injectable`): se
 *   construye aquí con sus dos adaptadores, que son la parte que PR-07/T3 dejó
 *   pendiente. `SuggestionsService` (T3) la reutiliza para `bossPending`.
 * - `JOB_DISPATCHER` no se importa: lo provee `QueuesModule`, que es
 *   `@Global()` (PEND-09 de docs/specs/pendientes/PR-05.md), así que
 *   `EndSessionService` lo inyecta directamente con `@Inject(JOB_DISPATCHER)`.
 */
@Module({
  imports: [LlmModule],
  controllers: [SessionsController],
  providers: [
    SessionsRepository,
    InsforgeBossRepository,
    RedisBossSkipStore,
    {
      provide: BossService,
      inject: [InsforgeBossRepository, RedisBossSkipStore],
      useFactory: (repository: InsforgeBossRepository, skipStore: RedisBossSkipStore) =>
        new BossService(repository, skipStore),
    },
    {
      // Aleatoriedad de la decisión de callback (RF-4.4) y de las sugerencias
      // de tema (SPEC-04 §7) inyectada, para que los tests fijen los valores.
      provide: SESSION_RANDOM,
      useValue: () => Math.random(),
    },
    SessionsService,
    TurnsRepository,
    TurnsService,
    EndSessionRepository,
    EndSessionService,
    SuggestionsRepository,
    SuggestionsService,
    SessionsHistoryRepository,
    SessionsHistoryService,
  ],
  exports: [SessionsService, TurnsService, EndSessionService, SuggestionsService, SessionsHistoryService],
})
export class SessionsModule {}
