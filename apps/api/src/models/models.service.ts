import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import type { Provider } from '../db/schema.js';
import {
  DEFAULT_AVG_TOKENS_IN,
  DEFAULT_AVG_TOKENS_OUT,
  ModelCatalogService,
  type CatalogModel,
} from '../llm/catalog.service.js';
import { effectivePlan } from '../profiles/plan.js';
import { ProfilesRepository } from '../profiles/profiles.repository.js';
import { RedisService } from '../redis/redis.service.js';
import type { UpdateModelPreferencesDto } from './dto/update-model-preferences.dto.js';
import { buildEstimatePerSession, groupModelsByProviderAndTier } from './models.mapper.js';
import { ModelPreferencesRepository } from './model-preferences.repository.js';
import type { ModelPreferenceResultDto, ModelsCatalogDto } from './models.types.js';
import { SessionUsageRepository } from './session-usage.repository.js';

/** `fetch` inyectable para el catálogo de 9router (los tests pasan uno falso). */
export const MODELS_FETCH = Symbol('MODELS_FETCH');

/**
 * `ModelsModule` (SPEC-02 §4.2, SPEC-03 §7): catálogo de modelos y
 * preferencias por rol.
 *
 * Envuelve `ModelCatalogService` (PR-03, `apps/api/src/llm/catalog.service.ts`)
 * en vez de reescribir el parseo, los tiers o el filtrado: solo le pasa
 * `RedisService` como `CacheStore` (compatible desde PR-02/T1,
 * docs/specs/pendientes/PR-02.md PEND-07) y el `fetch` inyectable de
 * `MODELS_FETCH`.
 */
@Injectable()
export class ModelsService {
  private readonly catalog: ModelCatalogService;

  constructor(
    private readonly modelPreferences: ModelPreferencesRepository,
    private readonly sessionUsage: SessionUsageRepository,
    private readonly profiles: ProfilesRepository,
    redisService: RedisService,
    @Inject(MODELS_FETCH) fetchImpl: typeof fetch,
    config: ConfigService<Env, true>,
  ) {
    this.catalog = new ModelCatalogService({
      cache: redisService,
      fetchImpl,
      baseUrl: config.get('NINEROUTER_URL', { infer: true }),
      apiKey: config.get('NINEROUTER_API_KEY', { infer: true }),
    });
  }

  /** `GET /models` (SPEC-02 §4.2): catálogo de 9router con la key del operador, igual para todos. */
  async getCatalog(userId: string): Promise<ModelsCatalogDto> {
    const models = await this.listCatalogModels();
    const { avgTokensIn, avgTokensOut } = await this.averageTokens(userId);

    return {
      providers: groupModelsByProviderAndTier(models),
      estimatePerSession: buildEstimatePerSession(models, avgTokensIn, avgTokensOut, (avgIn, avgOut, model) =>
        this.catalog.estimatePerSession(avgIn, avgOut, model),
      ),
    };
  }

  /**
   * `PUT /me/models` (SPEC-02 §4.2): valida la pertenencia al catálogo y
   * el plan (`403 PLAN_REQUIRED` si un Free elige un modelo de pago) para **cada** rol (chat y brief, que pueden usar proveedores
   * distintos) antes de escribir nada, y devuelve la preferencia guardada en
   * la forma plana que espera la app.
   */
  async updatePreferences(
    userId: string,
    dto: UpdateModelPreferencesDto,
  ): Promise<ModelPreferenceResultDto> {
    const models = await this.listCatalogModels();

    this.assertRoleIsAvailable(dto.chatProvider, dto.chatModel, models);
    this.assertRoleIsAvailable(dto.briefProvider, dto.briefModel, models);

    const profile = await this.profiles.findByUserId(userId);
    if (profile === null || effectivePlan(profile) === 'free') {
      const paid = models.some(
        (m) => m.tier !== 'free' && (m.id === dto.chatModel || m.id === dto.briefModel),
      );
      if (paid) {
        throw ApiException.of('PLAN_REQUIRED', 'Elegir un modelo de pago requiere el plan Pro.');
      }
    }

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

  /** `400 MODEL_NOT_AVAILABLE` si el modelo no está en el catálogo de ese proveedor. */
  private assertRoleIsAvailable(
    provider: Provider,
    modelId: string,
    models: readonly CatalogModel[],
  ): void {
    const exists = models.some((model) => model.provider === provider && model.id === modelId);
    if (!exists) {
      throw ApiException.of(
        'MODEL_NOT_AVAILABLE',
        `El modelo '${modelId}' no está en el catálogo de '${provider}'.`,
      );
    }
  }

  /**
   * Catálogo de 9router. Si la descarga falla y `ModelCatalogService` no
   * tiene ninguna caché con la que responder, lanza un error crudo (con la
   * API key ya redactada, ver `catalog.service.ts::redact`); aquí se convierte en un `ApiException`
   * con el formato de SPEC-02 §6 en vez de dejar que llegue como 500 sin
   * formato al cliente.
   */
  private async listCatalogModels(): Promise<CatalogModel[]> {
    try {
      return await this.catalog.listModels();
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
