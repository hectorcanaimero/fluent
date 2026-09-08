import { Module } from '@nestjs/common';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { OwnerService } from '../common/owner.service.js';
import { GroupsController } from './groups.controller.js';
import { GroupsRepository } from './groups.repository.js';
import { GroupsService } from './groups.service.js';

/**
 * Módulo de grupo e invitaciones (SPEC-02 §4.1).
 *
 * Declara `ProfilesRepository` y `OwnerService` como providers propios
 * (además de en otros módulos): son envoltorios sin estado sobre servicios
 * globales, así que evita crear dependencias circulares entre módulos que los
 * necesitan. Ver comentario en `ProgressModule` y `AdminModule`.
 */
@Module({
  controllers: [GroupsController],
  providers: [GroupsRepository, ProfilesRepository, OwnerService, GroupsService],
  exports: [GroupsRepository],
})
export class GroupsModule {}
