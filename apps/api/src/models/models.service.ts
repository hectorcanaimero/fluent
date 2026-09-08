import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { CredentialsService } from '../credentials/credentials.service.js';
import type { Provider } from '../db/schema.js';
import {
  DEFAULT_AVG_TOKENS_IN,
  DEFAULT_AVG_TOKENS_OUT,
  ModelCatalogService,
  type CatalogModel,
} from '../llm/catalog.service.js';
import { PROVIDER_FETCH, type FetchLike } from '../providers/provider-api.client.js';
import { RedisService } from '../redis/redis.service.js';
import type { UpdateModelPreferencesDto } from './dto/update-model-preferences.dto.js';
import { buildEstimatePerSession, groupModelsByProviderAndTier } from './models.mapper.js';
import { ModelPreferencesRepository } from './model-preferences.repository.js';
import type { ModelPreferenceResultDto, ModelsCatalogDto } from './models.types.js';
import { SessionUsageRepository } from './session-usage.repository.js';

/** Etiqueta legible del rol, para distinguir el motivo en el `message` (no en el `error`). */
const ROLE_LABELS = {
  chat: 'de chat',
  brief: 'de resumen de sesión (brief)',
} as const;

type ModelRole = keyof typeof ROLE_LABELS;

/**
 * `ModelsModule` (SPEC-02 §4.2, SPEC-03 §7): catálogo de modelos y
 * preferencias por rol.
 *
 * Envuelve `ModelCatalogService` (PR-03, `apps/api/src/llm/catalog.service.ts`)
 * en vez de reescribir el parseo, los tiers o el filtrado: solo le pasa
 * `RedisService` como `CacheStore` (compatible desde PR-02/T1,
 * docs/specs/pendientes/PR-02.md PEND-07) y el `fetch` inyectable de
 * `PROVIDER_FETCH` (mismo token de T4, reutilizado vía `ProviderFetchModule`
 * para no crear uno nuevo).
 */
@Injectable()
export class ModelsService {
  private readonly catalog: ModelCatalogService;

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly modelPreferences: ModelPreferencesRepository,
    private readonly sessionUsage: SessionUsageRepository,
    redisService: RedisService,
    @Inject(PROVIDER_FETCH) fetchImpl: FetchLike,
  ) {
    this.catalog = new ModelCatalogService({ cache: redisService, fetchImpl });
  }

  /**
   * `GET /models` (SPEC-02 §4.2). Descarga el catálogo con la credencial de
   * OpenRouter del usuario si la tiene (para que el catálogo devuelto
   * refleje exactamente lo que ese usuario puede usar; la lista pública de
   * OpenRouter no cambia según la key, pero la llamada sí la necesita si
   * OpenRouter empieza a exigirla) y, si no, sin `Authorization` (el
   * endpoint de modelos de OpenRouter es público).
   */
  async getCatalog(userId: string): Promise<ModelsCatalogDto> {
    const models = await this.listCatalogModels(userId);
    const { avgTokensIn, avgTokensOut } = await this.averageTokens(userId);

    return {
      providers: groupModelsByProviderAndTier(models),
      estimatePerSession: buildEstimatePerSession(models, avgTokensIn, avgTokensOut, (avgIn, avgOut, model) =>
        this.catalog.estimatePerSession(avgIn, avgOut, model),
      ),
    };
  }

  /**
   * `PUT /me/models` (SPEC-02 §4.2): valida crédito activo y pertenencia al
   * catálogo para **cada** rol (chat y brief, que pueden usar proveedores
   * distintos) antes de escribir nada, y devuelve la preferencia guardada en
   * la forma plana que espera la app.
   */
  async updatePreferences(
    userId: string,
    dto: UpdateModelPreferencesDto,
  ): Promise<ModelPreferenceResultDto> {
    const models = await this.listCatalogModels(userId);

    await this.assertRoleIsAvailable(userId, 'chat', dto.chatProvider, dto.chatModel, models);
    await this.assertRoleIsAvailable(userId, 'brief', dto.briefProvider, dto.briefModel, models);

    const saved = await this.modelPreferences.upsert(userId, {
      chat_provider: dto.chatProvider,
      chat_model: dto.chatModel,
      brief_provider: dto.briefProvider,
      brief_model: dto.briefModel,
    });

    return {
      chatProvider: saved.chat_provider,
      chatModel: saved.chat_model,
      briefProvider: saved.brief_provider,
      briefModel: saved.brief_model,
    };
  }

  /**
   * `400 MODEL_NOT_AVAILABLE` si el usuario no tiene credencial activa del
   * proveedor elegido para este rol, o si el modelo no está en el catálogo
   * de ese proveedor. El `error` es el mismo código en los dos casos (SPEC-02
   * §6 solo define uno); el `message` sí distingue el motivo.
   */
  private async assertRoleIsAvailable(
    userId: string,
    role: ModelRole,
    provider: Provider,
    modelId: string,
    models: readonly CatalogModel[],
  ): Promise<void> {
    const credential = await this.credentialsService.find(userId, provider);
    if (credential === null || credential.status !== 'active') {
      throw ApiException.of(
        'MODEL_NOT_AVAILABLE',
        `No tenés una credencial activa de '${provider}' para elegirlo como modelo ${ROLE_LABELS[role]}. Conectá el proveedor primero.`,
      );
    }

    const exists = models.some((model) => model.provider === provider && model.id === modelId);
    if (!exists) {
      throw ApiException.of(
        'MODEL_NOT_AVAILABLE',
        `El modelo '${modelId}' no está en el catálogo de '${provider}'.`,
      );
    }
  }

  /**
   * Catálogo completo (OpenRouter + Gemini). Si la descarga de OpenRouter
   * falla y `ModelCatalogService` no tiene ninguna caché con la que
   * responder, lanza un error crudo (con la API key ya redactada, ver
   * `catalog.service.ts::redact`); aquí se convierte en un `ApiException`
   * con el formato de SPEC-02 §6 en vez de dejar que llegue como 500 sin
   * formato al cliente.
   */
  private async listCatalogModels(userId: string): Promise<CatalogModel[]> {
    const apiKey = await this.credentialsService.getActiveApiKey(userId, 'openrouter');
    try {
      return await this.catalog.listModels(apiKey ?? undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw ApiException.of(
        'LLM_UNAVAILABLE',
        `No se pudo obtener el catálogo de modelos en este momento: ${message}`,
        { cause: error },
      );
    }
  }

  /**
   * Promedios de tokens por sesión del usuario (últimas 10, SPEC-03 §7) o
   * los valores por defecto si no tiene historial.
   */
  private async averageTokens(
    userId: string,
  ): Promise<{ avgTokensIn: number; avgTokensOut: number }> {
    const averages = await this.sessionUsage.averageTokensForRecentSessions(userId);
    return averages ?? { avgTokensIn: DEFAULT_AVG_TOKENS_IN, avgTokensOut: DEFAULT_AVG_TOKENS_OUT };
  }
}
