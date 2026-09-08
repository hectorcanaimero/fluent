import { Module } from '@nestjs/common';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { SessionsQueryModule } from '../sessions-query/sessions-query.module.js';
import { CorrectionsRepository } from './corrections.repository.js';
import { ProgressController } from './progress.controller.js';
import { InsforgeProgressRepository } from './progress.repository.js';
import { ProgressService } from './progress.service.js';

/**
 * Módulo de progreso (SPEC-02 §4.5, SPEC-07 §1): `GET /progress`.
 *
 * La lógica vive en `src/game/progress.service.ts` (PR-07/T1); aquí solo se
 * cablean el repositorio que la alimenta (`InsforgeProgressRepository`), el
 * adaptador `ProgressService` y el controlador.
 *
 * Declara `ProfilesRepository` como provider propio (además de en
 * `ProfilesModule`/`GroupsModule`/`SocialModule`): es un envoltorio sin
 * estado sobre el cliente admin de InsForge (global), así que repetir la
 * declaración evita una dependencia circular entre módulos sin ganar nada a
 * cambio (mismo patrón documentado en `GroupsModule`/`ProfilesModule`).
 */
@Module({
  imports: [SessionsQueryModule],
  controllers: [ProgressController],
  providers: [
    ProfilesRepository,
    CorrectionsRepository,
    InsforgeProgressRepository,
    ProgressService,
  ],
})
export class ProgressModule {}
