import { Module } from '@nestjs/common';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { SessionsQueryModule } from '../sessions-query/sessions-query.module.js';
import { CorrectionsRepository } from './corrections.repository.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

/**
 * Módulo de progreso (SPEC-02 §4.5, SPEC-07 §1): `GET /progress`.
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
  providers: [ProfilesRepository, CorrectionsRepository, ProgressService],
})
export class ProgressModule {}
