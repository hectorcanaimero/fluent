import { Module } from '@nestjs/common';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { ModelsModule } from '../models/models.module.js';
import { PkceStore } from './pkce.store.js';
import { ProviderApiClient } from './provider-api.client.js';
import { ProviderFetchModule } from './provider-fetch.module.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';

/**
 * Proveedores de LLM del usuario (SPEC-02 §4.2, RF-2.1 a RF-2.3): PKCE de
 * OpenRouter, conexión de Gemini, desconexión y estado con créditos.
 *
 * `ModelPreferencesRepository` vivió aquí temporalmente hasta PR-02/T5
 * (docs/specs/pendientes/PR-02.md PEND-26); ahora es de `ModelsModule`, que
 * este módulo importa solo para reutilizarla en `disconnect()` (resetea
 * preferencias que usaban el proveedor desconectado). `PROVIDER_FETCH` vive
 * en `ProviderFetchModule` por el mismo motivo: evita que `ProvidersModule`
 * y `ModelsModule` se importen mutuamente.
 */
@Module({
  imports: [CredentialsModule, ModelsModule, ProviderFetchModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, PkceStore, ProviderApiClient],
  exports: [ProvidersService],
})
export class ProvidersModule {}
