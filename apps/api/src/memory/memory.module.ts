import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller.js';
import { MemoryRepository } from './memory.repository.js';
import { MemoryService } from './memory.service.js';

/**
 * Módulo de memoria (SPEC-02 §4.4, RF-4.x): `facts` y `coaching_briefs`
 * (`GET /memory`, `PATCH /memory/facts/:id`, `DELETE /memory/facts/:id`,
 * `PUT /memory/brief`, `DELETE /memory`).
 *
 * `MemoryRepository` usa el cliente admin de InsForge (`INSFORGE_ADMIN_CLIENT`),
 * que expone `InsforgeModule` como módulo global — no hace falta importarlo
 * aquí (igual que en `GroupsModule`/`ProfilesModule`).
 */
@Module({
  controllers: [MemoryController],
  providers: [MemoryRepository, MemoryService],
})
export class MemoryModule {}
