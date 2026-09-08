import { Module, type Provider as NestProvider } from '@nestjs/common';
import { PROVIDER_FETCH } from './provider-api.client.js';

/**
 * `fetch` real para las llamadas salientes a OpenRouter y Gemini, como
 * provider de Nest bajo el token `PROVIDER_FETCH` (en vez de usar el global
 * directamente), para que los tests lo sustituyan por un doble y **nunca**
 * se llame a un proveedor real.
 *
 * `bind(globalThis)` porque `fetch` necesita su receptor original.
 */
const providerFetchProvider: NestProvider = {
  provide: PROVIDER_FETCH,
  useFactory: () => globalThis.fetch.bind(globalThis),
};

/**
 * Módulo mínimo que solo expone `PROVIDER_FETCH` (`docs/specs/pendientes/PR-02.md`).
 *
 * Extraído de `ProvidersModule` (donde vivía como provider inline hasta
 * PR-02/T5) para que `ModelsModule` pueda reutilizar el **mismo token** sin
 * crear una dependencia circular: `ProvidersModule` necesita
 * `ModelPreferencesRepository` de `ModelsModule` (para resetear preferencias
 * al desconectar un proveedor) y `ModelsModule` necesita `PROVIDER_FETCH` de
 * aquí, así que ninguno de los dos importa al otro — ambos importan este
 * módulo hoja.
 */
@Module({
  providers: [providerFetchProvider],
  exports: [PROVIDER_FETCH],
})
export class ProviderFetchModule {}
