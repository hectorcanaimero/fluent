import { Module, type Provider as NestProvider } from '@nestjs/common';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { ModelPreferencesRepository } from './model-preferences.repository.js';
import { PkceStore } from './pkce.store.js';
import { PROVIDER_FETCH, ProviderApiClient } from './provider-api.client.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';

/**
 * `fetch` real para las llamadas salientes a OpenRouter y Gemini. Se registra
 * como provider (en vez de usar el global dentro del cliente) para que los
 * tests lo sustituyan por un doble y **nunca** se llame a un proveedor real.
 *
 * `bind(globalThis)` porque `fetch` necesita su receptor original.
 */
const providerFetchProvider: NestProvider = {
  provide: PROVIDER_FETCH,
  useFactory: () => globalThis.fetch.bind(globalThis),
};

/**
 * Proveedores de LLM del usuario (SPEC-02 §4.2, RF-2.1 a RF-2.3): PKCE de
 * OpenRouter, conexión de Gemini, desconexión y estado con créditos.
 */
@Module({
  imports: [CredentialsModule],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    PkceStore,
    ProviderApiClient,
    ModelPreferencesRepository,
    providerFetchProvider,
  ],
  exports: [ProvidersService],
})
export class ProvidersModule {}
