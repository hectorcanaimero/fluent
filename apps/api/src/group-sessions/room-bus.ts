import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CACHE_CLIENT } from '../redis/redis.constants.js';

/**
 * Evento de una sala de sesión grupal, publicado/consumido por `RoomBus`.
 * Ver docs/arch/002-sesion-grupal.md §Interfaces → RoomBus.
 */
export type RoomEvent = {
  type:
    | 'message'
    | 'tutor_token'
    | 'corrections'
    | 'participants'
    | 'ended'
    | 'recap';
  data: unknown;
};

const PRESENCE_TTL_SECONDS = 45;

function channelFor(sessionId: string): string {
  return `gs:${sessionId}`;
}

function presenceKeyPrefix(sessionId: string): string {
  return `gs:${sessionId}:online:`;
}

/**
 * Pub/sub y presencia de las salas de sesión grupal sobre Redis.
 *
 * Multiplexa todos los canales `gs:{sessionId}` del proceso sobre una única
 * conexión suscriptora (duplicada de `REDIS_CACHE_CLIENT`), porque una
 * conexión Redis en modo suscriptor no puede ejecutar otros comandos: cada
 * sala nueva no abre un socket, solo añade un `SUBSCRIBE` sobre la misma
 * conexión y un listener en el mapa interno.
 */
@Injectable()
export class RoomBus {
  private readonly subscriber: Redis;
  private readonly listenersByChannel = new Map<
    string,
    Set<(event: RoomEvent) => void>
  >();

  constructor(@Inject(REDIS_CACHE_CLIENT) private readonly client: Redis) {
    // ponytail: duplicate() hereda el retryStrategy fail-fast de la caché
    // (se rinde tras 2 reintentos). Para una conexión de pub/sub de larga
    // vida esto puede dejarla sin reconectar tras una caída de Redis; subir
    // a reintentos indefinidos (como REDIS_QUEUE_CLIENT) si eso importa.
    this.subscriber = this.client.duplicate();
    this.subscriber.on('message', (channel: string, raw: string) => {
      const listeners = this.listenersByChannel.get(channel);
      if (!listeners || listeners.size === 0) return;
      const event = JSON.parse(raw) as RoomEvent;
      for (const listener of listeners) listener(event);
    });
  }

  async publish(sessionId: string, event: RoomEvent): Promise<void> {
    await this.client.publish(channelFor(sessionId), JSON.stringify(event));
  }

  subscribe(
    sessionId: string,
    onEvent: (event: RoomEvent) => void,
  ): () => void {
    const channel = channelFor(sessionId);
    let listeners = this.listenersByChannel.get(channel);
    if (!listeners) {
      listeners = new Set();
      this.listenersByChannel.set(channel, listeners);
      void this.subscriber.subscribe(channel);
    }
    listeners.add(onEvent);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        this.listenersByChannel.delete(channel);
        void this.subscriber.unsubscribe(channel);
      }
    };
  }

  async markOnline(sessionId: string, userId: string): Promise<void> {
    await this.client.set(
      `${presenceKeyPrefix(sessionId)}${userId}`,
      '1',
      'EX',
      PRESENCE_TTL_SECONDS,
    );
  }

  /**
   * `KEYS` sobre un patrón acotado a una sala (pocos participantes) en vez
   * de `SCAN`: el namespace es pequeño por diseño, no el keyspace completo.
   */
  async onlineUsers(sessionId: string): Promise<Set<string>> {
    const prefix = presenceKeyPrefix(sessionId);
    const keys = await this.client.keys(`${prefix}*`);
    return new Set(keys.map((key) => key.slice(prefix.length)));
  }
}
