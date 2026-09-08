import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { CredentialsService } from '../credentials/credentials.service.js';
import type { Provider } from '../db/schema.js';
import { ModelPreferencesRepository } from '../models/model-preferences.repository.js';
import {
  buildOpenRouterAuthUrl,
  codeChallengeS256,
  generateCodeVerifier,
  isValidCallbackUrl,
} from './pkce.js';
import { PkceStore } from './pkce.store.js';
import { ProviderApiClient } from './provider-api.client.js';
import type { PkceStartDtoResponse, ProviderStatusDto } from './providers.types.js';

/** Los dos proveedores de SPEC-01 §2.4 (CHECK de la columna `provider`). */
const PROVIDER_IDS: readonly Provider[] = ['openrouter', 'gemini'];

/**
 * Valida el parámetro de ruta `:provider` contra `openrouter|gemini`
 * (SPEC-02 §4.2). Cualquier otra cosa es `400 VALIDATION`.
 */
export function parseProvider(value: string): Provider {
  const normalized = value.trim().toLowerCase();
  if (!PROVIDER_IDS.includes(normalized as Provider)) {
    throw ApiException.of(
      'VALIDATION',
      `Proveedor desconocido: solo se admiten ${PROVIDER_IDS.join(' y ')}.`,
    );
  }
  return normalized as Provider;
}

/**
 * `ProvidersModule` (SPEC-02 §4.2, RF-2.1 a RF-2.3): PKCE de OpenRouter,
 * conexión de Gemini, desconexión y estado.
 *
 * Los mensajes de error van en español fijo, como los del `AuthGuard` y los
 * del `ValidationPipe` (docs/specs/pendientes/PR-02.md PEND-06 y PEND-20):
 * estos endpoints no cargan el perfil del usuario, así que no hay `locale`
 * del que tirar, y los textos son específicos del flujo (no los genéricos por
 * código del catálogo de i18n). El campo `error` del cuerpo, que es lo que
 * consume la app, sí es siempre el código de SPEC-02 §6.
 */
@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly defaultCallbackUrl: string;

  constructor(
    configService: ConfigService<Env, true>,
    private readonly credentialsService: CredentialsService,
    private readonly pkceStore: PkceStore,
    private readonly providerApi: ProviderApiClient,
    private readonly modelPreferences: ModelPreferencesRepository,
  ) {
    this.defaultCallbackUrl = configService.get('OPENROUTER_OAUTH_CALLBACK', {
      infer: true,
    });
  }

  /**
   * `POST /providers/openrouter/pkce/start` (SPEC-02 §4.2, SPEC-06 §7).
   *
   * Genera el `code_verifier`, lo guarda 10 minutos en Redis con un id opaco
   * y devuelve la URL que la app abre con `flutter_web_auth_2`. El verifier
   * nunca sale de la API.
   */
  async startOpenRouterPkce(
    userId: string,
    callbackUrl?: string,
  ): Promise<PkceStartDtoResponse> {
    const requested = callbackUrl?.trim() || this.defaultCallbackUrl;

    if (!isValidCallbackUrl(requested)) {
      throw ApiException.of(
        'VALIDATION',
        'callbackUrl debe ser una URL absoluta con esquema (por ejemplo fluent://oauth/openrouter).',
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeVerifierId = await this.pkceStore.create(userId, requested, codeVerifier);

    return {
      authUrl: buildOpenRouterAuthUrl(requested, codeChallengeS256(codeVerifier)),
      codeVerifierId,
    };
  }

  /**
   * `POST /providers/openrouter/pkce/complete` (SPEC-02 §4.2).
   *
   * Un `codeVerifierId` inexistente, caducado o de otro usuario responde
   * exactamente el mismo `400 VALIDATION` (docs/specs/pendientes/PR-02.md):
   * distinguirlos convertiría el endpoint en un oráculo de ids ajenos y no le
   * sirve de nada a la app, que en los tres casos tiene que reiniciar el
   * flujo desde `start`.
   */
  async completeOpenRouterPkce(
    userId: string,
    code: string,
    codeVerifierId: string,
  ): Promise<ProviderStatusDto> {
    const entry = await this.pkceStore.find(codeVerifierId);

    if (entry === null || entry.userId !== userId) {
      throw ApiException.of(
        'VALIDATION',
        'El intento de conexión con OpenRouter no existe o caducó. Volvé a empezar desde la app.',
      );
    }

    const apiKey = await this.providerApi.exchangeOpenRouterCode(code, entry.codeVerifier);

    if (apiKey === null) {
      // Un `code` solo se puede canjear una vez: aunque el canje falle, el
      // verifier ya no sirve para nada y se borra igual.
      await this.pkceStore.remove(codeVerifierId);
      throw ApiException.of(
        'PROVIDER_KEY_INVALID',
        'OpenRouter rechazó el código de autorización. Volvé a conectar la cuenta.',
      );
    }

    await this.credentialsService.saveApiKey(userId, 'openrouter', apiKey);
    // Un solo uso: el verifier se borra en cuanto el canje sale bien.
    await this.pkceStore.remove(codeVerifierId);

    return { provider: 'openrouter', status: 'active', lastError: null };
  }

  /**
   * `POST /providers/gemini` (SPEC-02 §4.2): valida la key contra `/models`
   * **antes** de guardar nada. Si Google la rechaza (401/403) o la llamada
   * falla, no se escribe ninguna fila.
   */
  async connectGemini(userId: string, apiKey: string): Promise<ProviderStatusDto> {
    const trimmed = apiKey.trim();
    const isValid = trimmed !== '' && (await this.providerApi.validateGeminiKey(trimmed));

    if (!isValid) {
      throw ApiException.of(
        'PROVIDER_KEY_INVALID',
        'Google rechazó esa API key de Gemini. Revisala y probá de nuevo.',
      );
    }

    await this.credentialsService.saveApiKey(userId, 'gemini', trimmed);

    return { provider: 'gemini', status: 'active', lastError: null };
  }

  /**
   * `DELETE /providers/:provider` (SPEC-02 §4.2): borra la credencial y
   * resetea las preferencias de modelo que la usaban. Idempotente: si no
   * había credencial, responde igualmente `204`.
   */
  async disconnect(userId: string, provider: Provider): Promise<void> {
    const removed = await this.credentialsService.remove(userId, provider);
    const preferencesReset = await this.modelPreferences.deleteIfUsesProvider(userId, provider);

    if (removed || preferencesReset) {
      this.logger.log(
        `Usuario ${userId} desconectó '${provider}'` +
          (preferencesReset ? ' (se resetearon sus preferencias de modelo)' : ''),
      );
    }
  }

  /**
   * `GET /providers/:provider/status` (SPEC-02 §4.2, RF-2.3).
   *
   * Sin fila en `provider_credentials` devuelve el mismo `not_connected` que
   * usa `GET /me` (docs/specs/pendientes/PR-02.md PEND-15). Para OpenRouter
   * con credencial activa añade `credits: { total, used }`; si la consulta de
   * créditos falla, devuelve el estado **sin** `credits` en vez de un 500.
   */
  async getStatus(userId: string, provider: Provider): Promise<ProviderStatusDto> {
    const credential = await this.credentialsService.find(userId, provider);

    if (credential === null) {
      return { provider, status: 'not_connected', lastError: null };
    }

    const status: ProviderStatusDto = {
      provider,
      status: credential.status,
      lastError: credential.last_error,
    };

    if (provider !== 'openrouter' || credential.status !== 'active') {
      return status;
    }

    const apiKey = await this.credentialsService.getActiveApiKey(userId, 'openrouter');
    if (apiKey === null) {
      return status;
    }

    const credits = await this.providerApi.fetchOpenRouterCredits(apiKey);
    return credits === null ? status : { ...status, credits };
  }
}
