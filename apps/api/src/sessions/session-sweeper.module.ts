import { Module } from '@nestjs/common';

import { SESSION_SWEEPER } from '../jobs/session-sweeper.js';
import { EndSessionRepository } from './end-session.repository.js';
import { SessionCloserService } from './session-closer.service.js';
import { SessionSweeperRepository } from './session-sweeper.repository.js';
import { SessionSweeperService } from './session-sweeper.service.js';

/**
 * Módulo hoja del binding real de `SESSION_SWEEPER` (SPEC-04 §6, PR-04/T5;
 * ver PEND-27 de docs/specs/pendientes/PR-05.md).
 *
 * Vive en `src/sessions/` (no en `src/jobs/maintenance/`, que es de PR-05)
 * porque es lógica de dominio de sesión. Lo importa `MaintenanceModule`, que
 * a su vez cuelga de `WorkerModule` — **no** de `AppModule` —, así que este
 * módulo no puede arrastrar nada que la API HTTP no necesite: por eso no
 * importa `SessionsModule` (que trae `LlmModule` y `SessionsController`) ni
 * ningún otro módulo de sesión. En vez de eso declara sus propios
 * providers — `EndSessionRepository` y `SessionCloserService`, los mismos
 * que usa `SessionsModule`, pero registrados aquí de forma independiente — y
 * su propio `SessionSweeperRepository`.
 *
 * Solo depende de tokens globales que `WorkerModule` ya provee:
 * `INSFORGE_ADMIN_CLIENT` (`InsforgeModule`, `@Global()`) y `JOB_DISPATCHER`
 * (`QueuesModule`, `@Global()`, PEND-09 de docs/specs/pendientes/PR-05.md).
 */
@Module({
  providers: [
    EndSessionRepository,
    SessionCloserService,
    SessionSweeperRepository,
    {
      provide: SESSION_SWEEPER,
      inject: [SessionSweeperRepository, SessionCloserService],
      useFactory: (repository: SessionSweeperRepository, closer: SessionCloserService) =>
        new SessionSweeperService({ repository, closer }),
    },
  ],
  exports: [SESSION_SWEEPER],
})
export class SessionSweeperModule {}
