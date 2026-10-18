/**
 * Escritura del stream SSE de `GET group-sessions/:id/stream`
 * (docs/arch/002-sesion-grupal.md §Interfaces → Stream SSE).
 *
 * No hace comprobaciones de acceso: las hace el controller (F6.3.T2) antes de
 * llamar a `openRoomStream`.
 */
import type { RoomBus, RoomEvent } from './room-bus.js';

const PING_INTERVAL_MS = 20_000;

/** Cabeceras SSE (docs/arch/002-sesion-grupal.md §Interfaces → Stream SSE). */
export const ROOM_STREAM_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
});

/** Lo mínimo de `express.Response` que necesita el stream. */
export interface RoomSseResponse {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): unknown;
  write(chunk: string): unknown;
  end(): unknown;
  on(event: 'close', listener: () => void): unknown;
}

export interface OpenRoomStreamOptions {
  readonly sessionId: string;
  readonly userId: string;
  readonly bus: Pick<RoomBus, 'subscribe' | 'markOnline'>;
  readonly canSeeCorrections: (authorId: string) => boolean | Promise<boolean>;
}

/** Datos del evento `corrections` (docs/arch/002-sesion-grupal.md). */
interface CorrectionsEventData {
  readonly authorId: string;
}

function isCorrectionsData(data: unknown): data is CorrectionsEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { authorId?: unknown }).authorId === 'string'
  );
}

/** Abre el stream SSE de la sala y lo deja escribiendo hasta `ended` o cierre del cliente. */
export function openRoomStream(
  res: RoomSseResponse,
  { sessionId, userId, bus, canSeeCorrections }: OpenRoomStreamOptions,
): void {
  for (const [name, value] of Object.entries(ROOM_STREAM_HEADERS)) {
    res.setHeader(name, value);
  }
  res.flushHeaders?.();

  const send = (event: RoomEvent): void => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  };

  void bus.markOnline(sessionId, userId);

  const ping = setInterval(() => {
    res.write(': ping\n\n');
    void bus.markOnline(sessionId, userId);
  }, PING_INTERVAL_MS);

  const stop = (): void => {
    clearInterval(ping);
    unsubscribe();
  };

  const unsubscribe = bus.subscribe(sessionId, (event) => {
    void handleEvent(event);
  });

  async function handleEvent(event: RoomEvent): Promise<void> {
    if (event.type === 'corrections' && isCorrectionsData(event.data)) {
      const { authorId } = event.data;
      if (authorId !== userId && !(await canSeeCorrections(authorId))) return;
    }

    send(event);

    if (event.type === 'ended') {
      stop();
      res.end();
    }
  }

  res.on('close', stop);
}
