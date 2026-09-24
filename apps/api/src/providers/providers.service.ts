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
import { FREE_COMBO } from '../llm/config.js';
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
/** Modelo gratuito por defecto de cada proveedor (SPEC-03 §2, RF-2.7). */
const DEFAULT_MODEL_BY_PROVIDER: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemma-3-27b-it:free',
  '9router': FREE_COMBO,
};

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly defaultCallbackUrl: string;
  private readonly apiPublicUrl: string;

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
    this.apiPublicUrl = configService.get('API_PUBLIC_URL', { infer: true }).replace(/\/+$/, '');
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

    if (!isValidCallbackUrl(requested, this.defaultCallbackUrl)) {
      throw ApiException.of(
        'VALIDATION',
        'callbackUrl solo puede ser el deep link de la app (fluent://…) o el callback configurado.',
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeVerifierId = await this.pkceStore.create(userId, requested, codeVerifier);

    // OpenRouter no devuelve de forma fiable a esquemas propios (fluent://):
    // el navegador vuelve a un callback HTTPS de la API, que guarda el código
    // y redirige al deep link guardado (`requested`); el canje lo hace después
    // la app con `POST /pkce/complete` (MAL-18).
    const browserCallback = `${this.apiPublicUrl}/v1/providers/openrouter/callback/${codeVerifierId}`;

    return {
      authUrl: buildOpenRouterAuthUrl(browserCallback, codeChallengeS256(codeVerifier)),
      codeVerifierId,
    };
  }

  /**
   * `POST /providers/openrouter/pkce/complete` (SPEC-02 §4.2, MAL-18).
   *
   * **Este** es el único sitio donde se canjea el `code` y se escribe la
   * credencial, y exige bearer: el callback del navegador es público y solo
   * deja el `code` guardado (`completeOpenRouterPkceFromBrowser`). Así, quien
   * termina el flujo es siempre el dueño del intento, no quien consiga que el
   * navegador visite una URL.
   *
   * Un `codeVerifierId` inexistente, caducado o de otro usuario responde
   * exactamente el mismo `403 FORBIDDEN`: distinguirlos convertiría el
   * endpoint en un oráculo de ids ajenos y no le sirve de nada a la app, que
   * en los tres casos tiene que reiniciar el flujo desde `start`.
   *
   * `code` en el cuerpo es el flujo antiguo (la app recibía el código por
   * deep link). Se mantiene por compatibilidad, pero el guardado por el
   * callback tiene prioridad: es el que llegó por el canal de confianza.
   */
  async completeOpenRouterPkce(
    userId: string,
    codeVerifierId: string,
    code?: string,
  ): Promise<ProviderStatusDto> {
    const entry = await this.pkceStore.find(codeVerifierId);

    if (entry === null || entry.userId !== userId) {
      throw ApiException.of(
        'FORBIDDEN',
        'El intento de conexión con OpenRouter no existe o caducó. Volvé a empezar desde la app.',
      );
    }

    const authorizationCode = entry.code ?? code?.trim();

    if (!authorizationCode) {
      // El dueño del intento llamó antes de volver del navegador: no es un
      // error de permisos, hay que esperar (o reiniciar) el flujo.
      throw ApiException.of(
        'VALIDATION',
        'Todavía no llegó la autorización de OpenRouter. Terminá el flujo en el navegador y probá de nuevo.',
      );
    }

    const apiKey = await this.providerApi.exchangeOpenRouterCode(
      authorizationCode,
      entry.codeVerifier,
    );

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
    await this.ensureDefaultPreferences(userId, 'openrouter');
    // Un solo uso: el verifier se borra en cuanto el canje sale bien.
    await this.pkceStore.remove(codeVerifierId);

    return { provider: 'openrouter', status: 'active', lastError: null };
  }


  /**
   * `GET /providers/openrouter/callback/:id?code=…` (público): lo abre el
   * navegador del teléfono al volver de OpenRouter.
   *
   * **Solo guarda el `code`** junto al `code_verifier` y devuelve a dónde
   * redirigir (el deep link de la app con `done=1` o con `error=…`). No
   * canjea nada ni escribe ninguna credencial: esta ruta es pública, así que
   * antes bastaba con que un atacante consiguiera que el navegador de la
   * víctima —o el suyo propio con un `code` de su cuenta— visitara esta URL
   * para escribir una credencial en la cuenta que abrió el flujo (CSRF de
   * MAL-18). El canje lo hace ahora `POST /pkce/complete`, autenticado.
   *
   * Nunca lanza: el navegador debe recibir siempre una página.
   */
  async completeOpenRouterPkceFromBrowser(
    codeVerifierId: string,
    code: string | undefined,
  ): Promise<{ ok: boolean; redirectTo: string; message: string }> {
    const entry = await this.pkceStore.find(codeVerifierId);
    // El destino sale de la entrada guardada en `start`, nunca de la query:
    // `callbackUrl` ya pasó por `isValidCallbackUrl` al crearse el intento.
    const appCallback = entry?.callbackUrl ?? this.defaultCallbackUrl;
    const withQuery = (q: string): string => `${appCallback}${appCallback.includes('?') ? '&' : '?'}${q}`;

    if (entry === null || !code) {
      return {
        ok: false,
        redirectTo: withQuery('error=expired'),
        message: 'El intento de conexión no existe o caducó. Volvé a empezar desde la app.',
      };
    }

    const stored = await this.pkceStore.attachCode(codeVerifierId, code);

    if (stored === null) {
      return {
        ok: false,
        redirectTo: withQuery('error=expired'),
        message: 'El intento de conexión no existe o caducó. Volvé a empezar desde la app.',
      };
    }

    this.logger.log(`Intento de PKCE ${codeVerifierId}: código recibido, pendiente de canje`);

    return { ok: true, redirectTo: withQuery('done=1'), message: 'Cuenta de OpenRouter conectada.' };
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
    await this.ensureDefaultPreferences(userId, 'gemini');

    return { provider: 'gemini', status: 'active', lastError: null };
  }


  /**
   * RF-2.7: "por defecto ambos roles usan el gratuito". Al conectar el primer
   * proveedor, si el usuario aún no eligió modelos, se le asignan los gratuitos
   * de ese proveedor para conversar y para el coach. Si ya tenía preferencias
   * no se tocan.
   */
  private async ensureDefaultPreferences(userId: string, provider: Provider): Promise<void> {
    const existing = await this.modelPreferences.find(userId);
    if (existing !== null) return;
    const model = DEFAULT_MODEL_BY_PROVIDER[provider];
    await this.modelPreferences.upsert(userId, {
      chat_provider: provider,
      chat_model: model,
      brief_provider: provider,
      brief_model: model,
    });
    this.logger.log(`Usuario ${userId}: preferencias de modelo por defecto '${provider}/${model}'`);
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
