import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { RoomBus, type RoomEvent } from './room-bus.js';

/**
 * `RoomBus` con `ioredis-mock`: comparte estado entre instancias con el
 * mismo host/puerto (por defecto), igual que `duplicate()` sobre Redis
 * real. Cada test usa un puerto distinto para no compartir datos ni
 * listeners de canal con los demás (ver README de ioredis-mock).
 */
describe('RoomBus', () => {
  let port = 10_000;

  afterEach(() => {
    vi.useRealTimers();
  });

  function buildBus(): RoomBus {
    const client = new RedisMock({ port: port++ }) as unknown as Redis;
    return new RoomBus(client);
  }

  /**
   * `ioredis-mock` entrega 'message' tras un `process.nextTick` interno
   * (igual que Redis real entrega por red, de forma asíncrona respecto al
   * `PUBLISH` que lo dispara). Un `publish()` resuelto solo confirma que
   * Redis recibió el mensaje, no que ya llegó a los suscriptores.
   */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
  }

  describe('publish/subscribe', () => {
    it('entrega el evento a dos suscriptores del mismo canal', async () => {
      const bus = buildBus();
      const received1: RoomEvent[] = [];
      const received2: RoomEvent[] = [];
      bus.subscribe('s1', (e) => received1.push(e));
      bus.subscribe('s1', (e) => received2.push(e));

      await bus.publish('s1', { type: 'message', data: { text: 'hola' } });
      await flush();

      expect(received1).toEqual([{ type: 'message', data: { text: 'hola' } }]);
      expect(received2).toEqual([{ type: 'message', data: { text: 'hola' } }]);
    });

    it('no entrega eventos de otra sala', async () => {
      const bus = buildBus();
      const received: RoomEvent[] = [];
      bus.subscribe('s1', (e) => received.push(e));

      await bus.publish('otra-sala', { type: 'message', data: {} });
      await flush();

      expect(received).toEqual([]);
    });

    it('tras el unsubscribe ya no llega nada', async () => {
      const bus = buildBus();
      const received: RoomEvent[] = [];
      const unsubscribe = bus.subscribe('s1', (e) => received.push(e));

      await bus.publish('s1', { type: 'message', data: 1 });
      await flush();
      unsubscribe();
      await bus.publish('s1', { type: 'message', data: 2 });
      await flush();

      expect(received).toEqual([{ type: 'message', data: 1 }]);
    });

    it('desuscribir a un listener no afecta a los demás del mismo canal', async () => {
      const bus = buildBus();
      const received1: RoomEvent[] = [];
      const received2: RoomEvent[] = [];
      const unsubscribe1 = bus.subscribe('s1', (e) => received1.push(e));
      bus.subscribe('s1', (e) => received2.push(e));

      unsubscribe1();
      await bus.publish('s1', { type: 'message', data: 'solo para el 2' });
      await flush();

      expect(received1).toEqual([]);
      expect(received2).toEqual([{ type: 'message', data: 'solo para el 2' }]);
    });
  });

  describe('presencia', () => {
    it('markOnline expira a los 45 s', async () => {
      vi.useFakeTimers();
      const bus = buildBus();

      await bus.markOnline('s1', 'u1');
      expect(await bus.onlineUsers('s1')).toEqual(new Set(['u1']));

      await vi.advanceTimersByTimeAsync(45_001);

      expect(await bus.onlineUsers('s1')).toEqual(new Set());
    });

    it('onlineUsers solo lista las claves vivas', async () => {
      vi.useFakeTimers();
      const bus = buildBus();

      await bus.markOnline('s1', 'u1');
      await vi.advanceTimersByTimeAsync(30_000);
      await bus.markOnline('s1', 'u2');
      await vi.advanceTimersByTimeAsync(20_000);

      // u1 marcó presencia hace 50 s (> 45 s TTL); u2 hace 20 s (vivo).
      expect(await bus.onlineUsers('s1')).toEqual(new Set(['u2']));
    });

    it('no mezcla la presencia de salas distintas', async () => {
      const bus = buildBus();

      await bus.markOnline('s1', 'u1');
      await bus.markOnline('s2', 'u2');

      expect(await bus.onlineUsers('s1')).toEqual(new Set(['u1']));
      expect(await bus.onlineUsers('s2')).toEqual(new Set(['u2']));
    });
  });
});
