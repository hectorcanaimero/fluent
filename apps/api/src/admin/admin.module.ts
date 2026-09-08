import { Module } from '@nestjs/common';
import { OwnerService } from '../common/owner.service.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { QueueMetricsService } from './queue-metrics.service.js';

/**
 * Módulo administrativo (SPEC-02 §4.6, RF-8.2, SPEC-05 §9):
 * `GET /admin/metrics`, con las métricas de producto de PR-02/T8 **y** los
 * contadores de las colas de BullMQ de PR-05 en la misma respuesta.
 *
 * Ya no declara el `OwnerAuthGuard` de PR-05: la ruta pasa por el `AuthGuard`
 * global (SPEC-02 §2, que además cachea la introspección) y `AdminService`
 * comprueba el owner con `OwnerService`. El panel `/admin/queues`, que va
 * fuera de Nest, usa `auth/owner-bearer.middleware.ts`, construido sobre esas
 * dos mismas piezas. Ver docs/specs/pendientes/PR-02.md PEND-73.
 *
 * Declara `OwnerService` como provider propio: aunque `GroupsModule` también
 * lo declara, ambos módulos lo hacen por separado para evitar una dependencia
 * circular (`GroupsModule` -> `AdminModule` -> `OwnerService` la crearía si
 * `OwnerService` viviera en `AdminModule`). Es un envoltorio sin estado sobre
 * `ConfigService` (global), igual que `ProfilesRepository` en `ProgressModule`.
 *
 * `QueueMetricsService` inyecta las 4 colas con `@InjectQueue`, que registra
 * `QueuesModule` (importado por `AppModule` antes que este módulo).
 */
@Module({
  controllers: [AdminController],
  providers: [OwnerService, AdminRepository, QueueMetricsService, AdminService],
})
export class AdminModule {}
