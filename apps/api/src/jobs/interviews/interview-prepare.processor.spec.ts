import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { InterviewPrepareJobData } from './interview-prepare.processor.js';
import { InterviewPrepareProcessor } from './interview-prepare.processor.js';
import type { InterviewPrepareService } from './interview-prepare.service.js';

const INTERVIEW_ID = '11111111-1111-4111-8111-111111111111';

function fakeService(options: { markFailedFinalThrows?: boolean } = {}) {
  const marked: string[] = [];
  const service = {
    markFailedFinal: async (interviewId: string) => {
      marked.push(interviewId);
      if (options.markFailedFinalThrows) throw new Error('InsForge caído');
    },
  };
  return { marked, service: service as unknown as InterviewPrepareService };
}

/** Job de BullMQ con lo justo que mira `onFailed`. */
function fakeJob(attemptsMade: number, attempts = 2): Job<InterviewPrepareJobData> {
  return {
    data: { interviewId: INTERVIEW_ID },
    attemptsMade,
    opts: { attempts },
  } as unknown as Job<InterviewPrepareJobData>;
}

describe('InterviewPrepareProcessor.onFailed (agente caído tras el reintento)', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marca `prep_failed` cuando se agotan los reintentos (attempts: 2, el valor de QUEUE_INTERVIEWS)', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service);

    await processor.onFailed(fakeJob(2, 2));

    expect(marked).toEqual([INTERVIEW_ID]);
  });

  it('no marca nada mientras quede el reintento', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service);

    await processor.onFailed(fakeJob(1, 2));

    expect(marked).toEqual([]);
  });

  it('sin job no hace nada', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service);

    await processor.onFailed(undefined);

    expect(marked).toEqual([]);
  });

  it('si la escritura falla, no propaga: BullMQ no tiene a quién avisar', async () => {
    const { service } = fakeService({ markFailedFinalThrows: true });
    const processor = new InterviewPrepareProcessor(service);

    await expect(processor.onFailed(fakeJob(2, 2))).resolves.toBeUndefined();
  });
});
