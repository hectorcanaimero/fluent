import type { Queue } from 'bullmq';

import { BullJobDispatcher } from './job-dispatcher.js';

/**
 * Doble de `Queue` con la deduplicación por `jobId` de BullMQ: un `add` con
 * un id que ya existe (vivo o fallido sin limpiar) no crea job nuevo.
 */
function fakeQueue() {
  const jobIds = new Set<string>();
  const added: string[] = [];
  const queue = {
    add: async (_name: string, _data: unknown, opts: { jobId: string }) => {
      if (jobIds.has(opts.jobId)) return;
      jobIds.add(opts.jobId);
      added.push(opts.jobId);
    },
  };
  return { queue: queue as unknown as Queue, added };
}

describe('BullJobDispatcher.enqueueInterviewPrepare', () => {
  it('un doble POST no duplica el job, pero crear→fallar→reintentar encola uno nuevo', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = new BullJobDispatcher(fakeQueue().queue, queue);

    await dispatcher.enqueueInterviewPrepare('i-1');
    await dispatcher.enqueueInterviewPrepare('i-1');
    expect(added).toEqual(['i-1']);

    // El job anterior falló y sigue guardado con id `i-1`.
    await dispatcher.enqueueInterviewPrepare('i-1', { retry: true });
    expect(added).toHaveLength(2);
    expect(added[1]).toMatch(/^i-1-retry-\d+$/);
    expect(added[1]).not.toContain(':');
  });
});

describe('BullJobDispatcher.enqueueInterviewFeedback', () => {
  it('no choca con el jobId del interview-prepare de la misma entrevista', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = new BullJobDispatcher(fakeQueue().queue, queue);

    await dispatcher.enqueueInterviewPrepare('i-1');
    await dispatcher.enqueueInterviewFeedback('i-1');
    expect(added).toEqual(['i-1', 'i-1-feedback']);
  });

  it('un doble hook no duplica el job, pero fallar→reintentar encola uno nuevo', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = new BullJobDispatcher(fakeQueue().queue, queue);

    await dispatcher.enqueueInterviewFeedback('i-1');
    await dispatcher.enqueueInterviewFeedback('i-1');
    expect(added).toEqual(['i-1-feedback']);

    await dispatcher.enqueueInterviewFeedback('i-1', { retry: true });
    expect(added).toHaveLength(2);
    expect(added[1]).toMatch(/^i-1-feedback-retry-\d+$/);
  });
});
