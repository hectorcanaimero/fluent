import { Module } from '@nestjs/common';
import { AdminRepository } from '../admin/admin.repository.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

/**
 * Cobro Pro (F4.1): `POST /webhooks/revenuecat`. Declara `AdminRepository`
 * como provider propio (reutiliza su `setPlan` de F2.3) en vez de importar
 * `AdminModule`, que arrastra las colas de BullMQ.
 */
@Module({
  controllers: [BillingController],
  providers: [AdminRepository, BillingService],
})
export class BillingModule {}
