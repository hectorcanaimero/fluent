import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller.js';
import { BadgesRepository } from './badges.repository.js';
import { BadgesService } from './badges.service.js';

/**
 * Insignias de logros. El otorgamiento vive en SQL (`award_badges`), que
 * llama `SessionCloserService` al cerrar cada sesión; este módulo solo lee.
 */
@Module({
  controllers: [BadgesController],
  providers: [BadgesRepository, BadgesService],
})
export class BadgesModule {}
