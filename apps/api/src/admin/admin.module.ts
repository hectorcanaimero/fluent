import { Module } from '@nestjs/common';
import { OwnerService } from '../common/owner.service.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';

/**
 * Módulo administrativo (SPEC-02 §4.6, RF-8.2): `GET /admin/metrics`.
 *
 * Declara `OwnerService` como provider propio: aunque se importará en
 * `GroupsModule` también (para refactorizar la regla de owner), ambos módulos
 * lo declaran independientemente para evitar crear una dependencia circular
 * (`GroupsModule` → `OwnerService` y `AdminModule` → `OwnerService` es OK;
 * `GroupsModule` → `AdminModule` → `OwnerService` crearía un ciclo si
 * `OwnerService` viviera en `AdminModule`). El patrón es que `OwnerService`
 * es un envoltorio sin estado sobre `ConfigService` (global), similar a
 * `ProfilesRepository` (ver comentario en `ProgressModule`).
 */
@Module({
  controllers: [AdminController],
  providers: [OwnerService, AdminRepository, AdminService],
})
export class AdminModule {}
