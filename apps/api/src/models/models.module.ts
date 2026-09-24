import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ModelPreferencesRepository } from './model-preferences.repository.js';
import { ModelsController } from './models.controller.js';
import { MODELS_FETCH, ModelsService } from './models.service.js';
import { SessionUsageRepository } from './session-usage.repository.js';

/**
 * Catálogo de modelos y preferencias por rol (SPEC-02 §4.2, SPEC-03 §7):
 * `GET /models`, `PUT /me/models`.
 *
 * `RedisService` e `INSFORGE_ADMIN_CLIENT`
 * no se importan aquí porque `RedisModule` e `InsforgeModule` son
 * `@Global()`.
 */
@Module({
  imports: [ProfilesModule],
  controllers: [ModelsController],
  providers: [
    { provide: MODELS_FETCH, useFactory: () => globalThis.fetch.bind(globalThis) },
    ModelsService,
    ModelPreferencesRepository,
    SessionUsageRepository,
  ],
})
export class ModelsModule {}
