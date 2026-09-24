import { Module } from '@nestjs/common';
import { GroupsRepository } from '../groups/groups.repository.js';
import { MeController } from './me.controller.js';
import { PendingActionsService } from './pending-actions.service.js';
import { ProfilesRepository } from './profiles.repository.js';
import { ProfilesService } from './profiles.service.js';
import { SessionsQueryModule } from '../sessions-query/sessions-query.module.js';

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
  // `PendingActionsService` inyecta `RedisService`, que viene de `RedisModule`
  // (`@Global()`), así que no hace falta importarlo aquí.
  // `SessionsQueryModule` es un módulo hoja (solo exporta el repositorio),
  // así que importarlo aquí no crea ciclos: lo comparten ya `ProgressModule` y
  // `SocialModule`.
  imports: [SessionsQueryModule],
  controllers: [MeController],
  providers: [
    ProfilesRepository,
    GroupsRepository,
    PendingActionsService,
    ProfilesService,
  ],
  exports: [ProfilesRepository],
})
export class ProfilesModule {}
