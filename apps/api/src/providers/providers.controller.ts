import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
@ApiTags('Providers')
@ApiBearerAuth()
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


  /**
   * Retorno del navegador tras autorizar en OpenRouter (SPEC-06 §7). Público:
   * el navegador externo no tiene el bearer de la app. Responde una página
   * mínima que redirige al deep link `fluent://oauth/openrouter`.
   */
  @Public()
  @Get('openrouter/callback/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async openRouterBrowserCallback(
    @Param('id') codeVerifierId: string,
    @Query('code') code?: string,
  ): Promise<string> {
    const result = await this.providersService.completeOpenRouterPkceFromBrowser(codeVerifierId, code);
    const title = result.ok ? 'Cuenta conectada' : 'No se pudo conectar';
    const escape = (v: string): string => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const target = escape(result.redirectTo);
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta http-equiv="refresh" content="0;url=${target}"><title>Fluent · ${title}</title>` +
      `<style>body{font-family:system-ui,sans-serif;background:#FAF8F4;color:#1C2024;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}a{display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#0E9C8C;color:#fff;text-decoration:none;font-weight:600}</style></head>` +
      `<body><div><h1>${title}</h1><p>${escape(result.message)}</p><a href="${target}">Volver a Fluent</a></div></body></html>`;
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
