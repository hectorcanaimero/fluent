import { Module } from '@nestjs/common';
import { BossService } from '../game/boss.service.js';
import { LlmModule } from '../llm/llm.module.js';
import { InsforgeBossRepository } from './boss.repository.js';
import { RedisBossSkipStore } from './boss-skip.store.js';
import { SessionsController } from './sessions.controller.js';
import { SESSION_RANDOM } from './sessions.constants.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';
import { TurnsRepository } from './turns.repository.js';
import { TurnsService } from './turns.service.js';

/**
 * Módulo de sesión de conversación (SPEC-02 §4.3, SPEC-04). Tras PR-04/T2
 * expone `POST /sessions` y `POST /sessions/:id/turns`; T3 añade cierre,
 * sugerencias, listado y detalle, y T4 el streaming.
 *
 * - `LlmModule` aporta el `LlmService` ya construido **y** reexporta
 *   `LlmInfraModule` → `CredentialsModule`, de donde sale `CredentialsService`
 *   (`CredentialsSource` de SPEC-03 §2).
 * - `InsforgeModule` (cliente admin) y `RedisModule` (`RedisService`) son
 *   globales, así que no hace falta importarlos.
 * - `BossService` es una clase pura de `src/game/` (sin `@Injectable`): se
 *   construye aquí con sus dos adaptadores, que son la parte que PR-07/T3 dejó
 *   pendiente.
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
      // Aleatoriedad de la decisión de callback (RF-4.4) inyectada, para que
      // los tests fijen los dos lados de `CALLBACK_PROBABILITY`.
      provide: SESSION_RANDOM,
      useValue: () => Math.random(),
    },
    SessionsService,
    TurnsRepository,
    TurnsService,
  ],
  exports: [SessionsService, TurnsService],
})
export class SessionsModule {}
