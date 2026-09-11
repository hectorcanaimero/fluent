import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CoachingBriefProcessor } from './coaching-brief.processor.js';
import type { CoachingBriefService } from './coaching-brief.service.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function fakeService(options: { markFailedThrows?: boolean } = {}) {
  const marked: string[] = [];
  const service = {
    markFailed: async (sessionId: string) => {
      marked.push(sessionId);
      if (options.markFailedThrows) throw new Error('InsForge caído');
    },
  };
  return { marked, service: service as unknown as CoachingBriefService };
}

/** Job de BullMQ con lo justo que mira `onFailed`. */
function fakeJob(attemptsMade: number, attempts = 3): Job<{ sessionId: string }> {
  return {
    data: { sessionId: SESSION_ID },
    attemptsMade,
    opts: { attempts },
  } as unknown as Job<{ sessionId: string }>;
}

describe('CoachingBriefProcessor.onFailed (MAL-20)', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marca `failed` cuando se agotan los reintentos', async () => {
    const { marked, service } = fakeService();
    const processor = new CoachingBriefProcessor(service);

    await processor.onFailed(fakeJob(3, 3));

    expect(marked).toEqual([SESSION_ID]);
  });

  it('no marca nada mientras queden reintentos', async () => {
    const { marked, service } = fakeService();
    const processor = new CoachingBriefProcessor(service);

    // BullMQ emite `failed` en cada intento: marcar aquí daría por definitivo
    // un fallo del que todavía se va a reintentar.
    await processor.onFailed(fakeJob(1, 3));
    await processor.onFailed(fakeJob(2, 3));

    expect(marked).toEqual([]);
  });

  it('trata `attempts` ausente como un único intento', async () => {
    const { marked, service } = fakeService();
    const processor = new CoachingBriefProcessor(service);

    await processor.onFailed({
      data: { sessionId: SESSION_ID },
      attemptsMade: 1,
      opts: {},
    } as unknown as Job<{ sessionId: string }>);

    expect(marked).toEqual([SESSION_ID]);
  });

  it('sin job no hace nada', async () => {
    const { marked, service } = fakeService();
    const processor = new CoachingBriefProcessor(service);

    await processor.onFailed(undefined);

    expect(marked).toEqual([]);
  });

  it('si la escritura falla, no propaga: BullMQ no tiene a quién avisar', async () => {
    const { service } = fakeService({ markFailedThrows: true });
    const processor = new CoachingBriefProcessor(service);

    await expect(processor.onFailed(fakeJob(3, 3))).resolves.toBeUndefined();
  });
});
