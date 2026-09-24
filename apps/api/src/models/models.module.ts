import { Module } from '@nestjs/common';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ProviderFetchModule } from '../providers/provider-fetch.module.js';
import { ModelPreferencesRepository } from './model-preferences.repository.js';
import { ModelsController } from './models.controller.js';
import { ModelsService } from './models.service.js';
import { SessionUsageRepository } from './session-usage.repository.js';

/**
 * Catálogo de modelos y preferencias por rol (SPEC-02 §4.2, SPEC-03 §7):
 * `GET /models`, `PUT /me/models`.
 *
 * Exporta `ModelPreferencesRepository` para que `ProvidersModule` la
 * reutilice en `DELETE /providers/:provider` (docs/specs/pendientes/PR-02.md
 * PEND-26) sin duplicar la clase. `RedisService` e `INSFORGE_ADMIN_CLIENT`
 * no se importan aquí porque `RedisModule` e `InsforgeModule` son
 * `@Global()`.
 */
@Module({
  imports: [CredentialsModule, ProviderFetchModule, ProfilesModule],
  controllers: [ModelsController],
  providers: [ModelsService, ModelPreferencesRepository, SessionUsageRepository],
  exports: [ModelPreferencesRepository],
})
export class ModelsModule {}
