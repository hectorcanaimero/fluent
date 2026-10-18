import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { RoomBus } from './room-bus.js';

/**
 * Módulo mínimo con `RoomBus`, separado del controller/servicio de
 * `group-sessions` para que el worker (F7) lo importe sin arrastrar rutas
 * HTTP.
 */
@Module({
  imports: [RedisModule],
  providers: [RoomBus],
  exports: [RoomBus],
})
export class GroupRealtimeModule {}
