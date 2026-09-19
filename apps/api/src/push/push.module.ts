import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { PushRepository } from './push.repository.js';
import { PushSender } from './push.sender.js';
import { PushService } from './push.service.js';

/**
 * Notificaciones push (FCM). La API registra tokens y avisa de desafíos; el
 * worker lo importa sin el controlador para avisar del resumen semanal.
 */
@Module({
  providers: [PushRepository, PushSender, PushService],
  exports: [PushService],
})
export class PushCoreModule {}

@Module({
  imports: [PushCoreModule],
  controllers: [PushController],
})
export class PushModule {}
