import type { RoomEvent } from './room-bus.js';
import { openRoomStream, type RoomSseResponse } from './room-stream.js';

/** Bus en memoria: un `publish` directo entrega el evento a los suscriptores. */
class InMemoryBus {
  private readonly listeners = new Map<string, Set<(event: RoomEvent) => void>>();
  readonly markOnlineCalls: Array<readonly [string, string]> = [];

  subscribe(sessionId: string, onEvent: (event: RoomEvent) => void): () => void {
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(onEvent);
    return () => set?.delete(onEvent);
  }

  async markOnline(sessionId: string, userId: string): Promise<void> {
    this.markOnlineCalls.push([sessionId, userId]);
  }

  publish(sessionId: string, event: RoomEvent): void {
    for (const listener of this.listeners.get(sessionId) ?? []) listener(event);
  }

  listenerCount(sessionId: string): number {
    return this.listeners.get(sessionId)?.size ?? 0;
  }
}

interface FakeResponse extends RoomSseResponse {
  readonly headers: Record<string, string>;
  readonly chunks: string[];
  ended: number;
  close(): void;
}

function fakeResponse(): FakeResponse {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let closeListener: (() => void) | null = null;

  return {
    headers,
    chunks,
    ended: 0,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    flushHeaders() {},
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      this.ended++;
      return true;
    },
    on(event: 'close', listener: () => void) {
      if (event === 'close') closeListener = listener;
    },
    close() {
      closeListener?.();
    },
  };
}

function events(res: FakeResponse): Array<{ event: string; data: unknown }> {
  return res.chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.trim() !== '' && !block.startsWith(':'))
    .map((block) => {
      const [eventLine = '', dataLine = ''] = block.split('\n');
      return {
        event: eventLine.replace(/^event: /, ''),
        data: JSON.parse(dataLine.replace(/^data: /, '')) as unknown,
      };
    });
}

const SESSION_ID = 'room-1';
const USER_ID = 'user-1';

describe('openRoomStream', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('escribe las cabeceras SSE y marca presencia al abrir', () => {
    const res = fakeResponse();
    const bus = new InMemoryBus();

    openRoomStream(res, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      bus,
      canSeeCorrections: () => false,
    });

    expect(res.headers).toEqual({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    });
    expect(bus.markOnlineCalls).toEqual([[SESSION_ID, USER_ID]]);
  });

  it('reenvía cada `RoomEvent` como `event: <type>`', () => {
    const res = fakeResponse();
    const bus = new InMemoryBus();

    openRoomStream(res, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      bus,
      canSeeCorrections: () => false,
    });

    bus.publish(SESSION_ID, { type: 'message', data: { id: 1, text: 'Hola' } });
    bus.publish(SESSION_ID, { type: 'participants', data: [{ userId: USER_ID }] });

    expect(events(res)).toEqual([
      { event: 'message', data: { id: 1, text: 'Hola' } },
      { event: 'participants', data: [{ userId: USER_ID }] },
    ]);
  });

  describe('filtro de `corrections`', () => {
    it('reenvía las correcciones propias sin consultar `canSeeCorrections`', () => {
      const res = fakeResponse();
      const bus = new InMemoryBus();
      const canSeeCorrections = vi.fn(() => false);

      openRoomStream(res, { sessionId: SESSION_ID, userId: USER_ID, bus, canSeeCorrections });

      bus.publish(SESSION_ID, {
        type: 'corrections',
        data: { authorId: USER_ID, items: [] },
      });

      expect(events(res)).toEqual([
        { event: 'corrections', data: { authorId: USER_ID, items: [] } },
      ]);
    });

    it('reenvía las correcciones ajenas si `canSeeCorrections` dice que sí', async () => {
      const res = fakeResponse();
      const bus = new InMemoryBus();

      openRoomStream(res, {
        sessionId: SESSION_ID,
        userId: USER_ID,
        bus,
        canSeeCorrections: async (authorId) => authorId === 'other-user',
      });

      bus.publish(SESSION_ID, {
        type: 'corrections',
        data: { authorId: 'other-user', items: [] },
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(events(res)).toEqual([
        { event: 'corrections', data: { authorId: 'other-user', items: [] } },
      ]);
    });

    it('no reenvía las correcciones ajenas no compartidas', async () => {
      const res = fakeResponse();
      const bus = new InMemoryBus();

      openRoomStream(res, {
        sessionId: SESSION_ID,
        userId: USER_ID,
        bus,
        canSeeCorrections: async () => false,
      });

      bus.publish(SESSION_ID, {
        type: 'corrections',
        data: { authorId: 'other-user', items: [] },
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(events(res)).toEqual([]);
    });
  });

  it('cada 20s escribe `: ping` y marca presencia de nuevo', () => {
    vi.useFakeTimers();
    const res = fakeResponse();
    const bus = new InMemoryBus();

    openRoomStream(res, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      bus,
      canSeeCorrections: () => false,
    });

    vi.advanceTimersByTime(20_000);
    vi.advanceTimersByTime(20_000);

    expect(res.chunks.filter((chunk) => chunk === ': ping\n\n')).toHaveLength(2);
    expect(bus.markOnlineCalls).toEqual([
      [SESSION_ID, USER_ID],
      [SESSION_ID, USER_ID],
      [SESSION_ID, USER_ID],
    ]);
  });

  it('al cerrar el cliente, desuscribe y para el ping', () => {
    vi.useFakeTimers();
    const res = fakeResponse();
    const bus = new InMemoryBus();

    openRoomStream(res, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      bus,
      canSeeCorrections: () => false,
    });

    expect(bus.listenerCount(SESSION_ID)).toBe(1);

    res.close();

    expect(bus.listenerCount(SESSION_ID)).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(res.chunks.filter((chunk) => chunk === ': ping\n\n')).toHaveLength(0);

    bus.publish(SESSION_ID, { type: 'message', data: {} });
    expect(events(res)).toEqual([]);
  });

  it('tras reenviar `ended`, cierra el stream', () => {
    vi.useFakeTimers();
    const res = fakeResponse();
    const bus = new InMemoryBus();

    openRoomStream(res, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      bus,
      canSeeCorrections: () => false,
    });

    bus.publish(SESSION_ID, { type: 'ended', data: { reason: 'completed', xp: [] } });

    expect(events(res)).toEqual([
      { event: 'ended', data: { reason: 'completed', xp: [] } },
    ]);
    expect(res.ended).toBe(1);
    expect(bus.listenerCount(SESSION_ID)).toBe(0);

    // El ping ya no corre tras `ended`.
    vi.advanceTimersByTime(60_000);
    expect(res.chunks.filter((chunk) => chunk === ': ping\n\n')).toHaveLength(0);
  });
});
