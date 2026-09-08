import { Module } from '@nestjs/common';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { GroupsRepository } from '../groups/groups.repository.js';
import { MeController } from './me.controller.js';
import { ProfilesRepository } from './profiles.repository.js';
import { ProfilesService } from './profiles.service.js';

/**
 * Módulo de cuenta y perfil (SPEC-02 §4.1).
 *
 * Incluye `GroupsRepository` como provider propio (además de en
 * `GroupsModule`): ambos repositorios son envoltorios sin estado sobre el
 * cliente admin de InsForge (`INSFORGE_ADMIN_CLIENT`, global), así que
 * declararlos en los dos módulos que los necesitan evita una dependencia
 * circular entre `ProfilesModule` y `GroupsModule` (que si no, se
 * necesitarían mutuamente: `GET /me` lee el grupo del usuario y
 * `POST /admin/invitations` lee su perfil) sin ganar nada a cambio, porque
 * ninguno de los dos guarda estado propio.
 */
@Module({
  // `GET /me` necesita el estado de `provider_credentials`, que desde
  // PR-02/T4 lee `CredentialsRepository` (docs/specs/pendientes/PR-02.md
  // PEND-15). La dependencia va en un solo sentido: `CredentialsModule` no
  // conoce a `ProfilesModule`.
  imports: [CredentialsModule],
  controllers: [MeController],
  providers: [ProfilesRepository, GroupsRepository, ProfilesService],
  exports: [ProfilesRepository],
})
export class ProfilesModule {}
