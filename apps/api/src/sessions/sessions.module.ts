import { Module } from '@nestjs/common';
import { BossService } from '../game/boss.service.js';
import { LlmModule } from '../llm/llm.module.js';
import { InsforgeBossRepository } from './boss.repository.js';
import { RedisBossSkipStore } from './boss-skip.store.js';
import { SessionsController } from './sessions.controller.js';
import { SESSION_RANDOM } from './sessions.constants.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';

/**
 * Módulo de sesión de conversación (SPEC-02 §4.3, SPEC-04). En PR-04/T1 solo
 * expone `POST /sessions`; T2 y T3 añaden turnos, cierre y sugerencias.
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
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
