import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UpdateModelPreferencesDto } from './dto/update-model-preferences.dto.js';
import { ModelsService } from './models.service.js';
import type { ModelPreferenceResultDto, ModelsCatalogDto } from './models.types.js';

/**
 * `GET /models` y `PUT /me/models` (SPEC-02 §4.2). Exige bearer como el
 * resto de la API (guard global de PR-02/T1); ninguna ruta se marca
 * `@Public()`.
 */
@Controller()
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('models')
  getModels(@CurrentUser('id') userId: string): Promise<ModelsCatalogDto> {
    return this.modelsService.getCatalog(userId);
  }

  /** Devuelve el `modelPreference` **plano** (no envuelto), como pide el contrato de la app. */
  @Put('me/models')
  updateModels(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateModelPreferencesDto,
  ): Promise<ModelPreferenceResultDto> {
    return this.modelsService.updatePreferences(userId, dto);
  }
}
