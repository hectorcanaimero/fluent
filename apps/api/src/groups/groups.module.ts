import { Module } from '@nestjs/common';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { GroupsController } from './groups.controller.js';
import { GroupsRepository } from './groups.repository.js';
import { GroupsService } from './groups.service.js';

/**
 * Módulo de grupo e invitaciones (SPEC-02 §4.1).
 *
 * Declara `ProfilesRepository` como provider propio (además de en
 * `ProfilesModule`): ver el comentario de `ProfilesModule` sobre por qué
 * (evitar una dependencia circular entre módulos para dos repositorios sin
 * estado propio).
 */
@Module({
  controllers: [GroupsController],
  providers: [GroupsRepository, ProfilesRepository, GroupsService],
  exports: [GroupsRepository],
})
export class GroupsModule {}
