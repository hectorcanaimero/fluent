import { Module } from '@nestjs/common';
import { GroupsRepository } from '../groups/groups.repository.js';
import { PushController } from './push.controller.js';
import { PushRepository } from './push.repository.js';
import { PushSender } from './push.sender.js';
import { PushService } from './push.service.js';

/**
 * Notificaciones push (FCM). La API registra tokens y avisa de desafíos; el
 * worker lo importa sin el controlador para avisar del resumen semanal.
 *
 * Declara `GroupsRepository` como provider propio (igual que en
 * `GroupsModule`): es un envoltorio sin estado sobre el cliente admin, así
 * que evita una dependencia circular entre módulos que lo necesitan.
 */
@Module({
  providers: [PushRepository, PushSender, PushService, GroupsRepository],
  exports: [PushService],
})
export class PushCoreModule {}

@Module({
  imports: [PushCoreModule],
  controllers: [PushController],
})
export class PushModule {}
