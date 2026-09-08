import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ConnectGeminiDto } from './dto/connect-gemini.dto.js';
import { PkceCompleteDto } from './dto/pkce-complete.dto.js';
import { PkceStartDto } from './dto/pkce-start.dto.js';
import { parseProvider, ProvidersService } from './providers.service.js';
import type { PkceStartDtoResponse, ProviderStatusDto } from './providers.types.js';

/**
 * Proveedores de LLM (SPEC-02 §4.2, RF-2.1 a RF-2.3). Todas las rutas exigen
 * bearer (guard global de PR-02/T1).
 *
 * `POST /providers/openrouter/pkce/complete`, `POST /providers/gemini` y
 * `GET /providers/:provider/status` devuelven la misma forma
 * (`{ status, lastError, credits? }`), que es la que parsea la app con
 * `ProviderStatusResult` (`apps/mobile/lib/core/api/models.dart`).
 */
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post('openrouter/pkce/start')
  startOpenRouterPkce(
    @CurrentUser('id') userId: string,
    @Body() dto: PkceStartDto,
  ): Promise<PkceStartDtoResponse> {
    return this.providersService.startOpenRouterPkce(userId, dto.callbackUrl);
  }

  @Post('openrouter/pkce/complete')
  completeOpenRouterPkce(
    @CurrentUser('id') userId: string,
    @Body() dto: PkceCompleteDto,
  ): Promise<ProviderStatusDto> {
    return this.providersService.completeOpenRouterPkce(userId, dto.code, dto.codeVerifierId);
  }

  @Post('gemini')
  connectGemini(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectGeminiDto,
  ): Promise<ProviderStatusDto> {
    return this.providersService.connectGemini(userId, dto.apiKey);
  }

  /** SPEC-02 §4.2: responde `204` sin cuerpo, también si no había credencial. */
  @Delete(':provider')
  @HttpCode(204)
  async disconnect(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ): Promise<void> {
    await this.providersService.disconnect(userId, parseProvider(provider));
  }

  @Get(':provider/status')
  getStatus(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ): Promise<ProviderStatusDto> {
    return this.providersService.getStatus(userId, parseProvider(provider));
  }
}
