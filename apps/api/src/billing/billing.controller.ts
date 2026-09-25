import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { BillingService } from './billing.service.js';
import type { RevenueCatWebhookDto } from './dto/revenuecat-event.dto.js';

/**
 * Webhook de RevenueCat (F4.1.T1). `@Public()` porque no trae bearer de
 * usuario: se autentica con el secreto compartido, que valida el servicio.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('revenuecat')
  @HttpCode(200)
  async revenuecat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RevenueCatWebhookDto,
  ): Promise<{ ok: true }> {
    await this.billingService.handleWebhook(authorization, body);
    return { ok: true };
  }
}
