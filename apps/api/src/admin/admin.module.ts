import { Module } from '@nestjs/common';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';

@Module({
  controllers: [AdminMetricsController],
  providers: [OwnerAuthGuard],
})
export class AdminModule {}
