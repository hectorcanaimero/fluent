import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';

import {
  AgentInvalidResponseError,
  AgentUnavailableError,
} from '../../interviews/interview-agent.client.js';
import { JOB_INTERVIEW_FEEDBACK, JOB_INTERVIEW_PREPARE } from '../jobs.constants.js';

import type { InterviewFeedbackService } from './interview-feedback.service.js';
import type { InterviewPrepareJobData } from '../job-dispatcher.js';
import { InterviewPrepareProcessor } from './interview-prepare.processor.js';
import type { InterviewPrepareService } from './interview-prepare.service.js';

const INTERVIEW_ID = '11111111-1111-4111-8111-111111111111';

function fakeService(options: { markFailedFinalThrows?: boolean; runThrows?: Error } = {}) {
  const marked: string[] = [];
  const codes: string[] = [];
  const service = {
    markFailedFinal: async (interviewId: string, code: string) => {
      marked.push(interviewId);
      codes.push(code);
      if (options.markFailedFinalThrows) throw new Error('InsForge caído');
    },
    run: vi.fn(async () => {
      if (options.runThrows) throw options.runThrows;
      return { status: 'ready' as const };
    }),
  };
  return { marked, codes, service: service as unknown as InterviewPrepareService & typeof service };
}

function fakeFeedbackService(
  options: { markFailedFinalThrows?: boolean; runThrows?: Error } = {},
) {
  const marked: string[] = [];
  const codes: string[] = [];
  const service = {
    markFailedFinal: async (interviewId: string, code: string) => {
      marked.push(interviewId);
      codes.push(code);
      if (options.markFailedFinalThrows) throw new Error('InsForge caído');
    },
    run: vi.fn(async () => {
      if (options.runThrows) throw options.runThrows;
      return { status: 'ready' as const };
    }),
  };
  return {
    marked,
    codes,
    service: service as unknown as InterviewFeedbackService & typeof service,
  };
}

/** Job de BullMQ con lo justo que miran `onFailed` y `process`. */
function fakeJob(
  attemptsMade: number,
  attempts = 2,
  name: string = JOB_INTERVIEW_PREPARE,
): Job<InterviewPrepareJobData> {
  return {
    id: 'job-1',
    name,
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
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await processor.onFailed(fakeJob(2, 2));

    expect(marked).toEqual([INTERVIEW_ID]);
  });

  it('no marca nada mientras quede el reintento', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await processor.onFailed(fakeJob(1, 2));

    expect(marked).toEqual([]);
  });

  it('sin job no hace nada', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await processor.onFailed(undefined);

    expect(marked).toEqual([]);
  });

  it('guarda el error_code real del último fallo', async () => {
    const { codes, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await processor.onFailed(fakeJob(2, 2), new AgentUnavailableError('timeout'));

    expect(codes).toEqual(['agent_unavailable']);
  });

  it('UnrecoverableError en el primer intento: marca ya, con el código de la causa', async () => {
    const { codes, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);
    const error = new UnrecoverableError('inválida');
    error.cause = new AgentInvalidResponseError('inválida');

    await processor.onFailed(fakeJob(1, 2), error);

    expect(codes).toEqual(['agent_invalid_response']);
  });

  it('un fallo de `interview-feedback` no toca `InterviewPrepareService` (F12.3.T1)', async () => {
    const { marked, service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await processor.onFailed(fakeJob(2, 2, JOB_INTERVIEW_FEEDBACK), new Error('x'));

    expect(marked).toEqual([]);
  });

  it('si la escritura falla, no propaga: BullMQ no tiene a quién avisar', async () => {
    const { service } = fakeService({ markFailedFinalThrows: true });
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await expect(processor.onFailed(fakeJob(2, 2))).resolves.toBeUndefined();
  });
});

describe('InterviewPrepareProcessor.onFailed — interview-feedback (F12.3.T1)', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marca `feedback_failed` cuando se agotan los reintentos', async () => {
    const { marked, codes, service: feedbackService } = fakeFeedbackService();
    const processor = new InterviewPrepareProcessor(fakeService().service, feedbackService);

    await processor.onFailed(
      fakeJob(2, 2, JOB_INTERVIEW_FEEDBACK),
      new AgentUnavailableError('timeout'),
    );

    expect(marked).toEqual([INTERVIEW_ID]);
    expect(codes).toEqual(['agent_unavailable']);
  });

  it('un fallo de `interview-prepare` no toca `InterviewFeedbackService`', async () => {
    const { marked, service: feedbackService } = fakeFeedbackService();
    const processor = new InterviewPrepareProcessor(fakeService().service, feedbackService);

    await processor.onFailed(fakeJob(2, 2, JOB_INTERVIEW_PREPARE), new Error('x'));

    expect(marked).toEqual([]);
  });

  it('si la escritura falla, no propaga', async () => {
    const { service: feedbackService } = fakeFeedbackService({ markFailedFinalThrows: true });
    const processor = new InterviewPrepareProcessor(fakeService().service, feedbackService);

    await expect(
      processor.onFailed(fakeJob(2, 2, JOB_INTERVIEW_FEEDBACK)),
    ).resolves.toBeUndefined();
  });
});

describe('InterviewPrepareProcessor.process', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('despacha interview-prepare al servicio con intento y dueño del candado', async () => {
    const { service } = fakeService();
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await expect(processor.process(fakeJob(0))).resolves.toEqual({ status: 'ready' });
    expect(service.run).toHaveBeenCalledWith(INTERVIEW_ID, 1, 'job-1');
  });

  it('despacha interview-feedback al servicio de parecer con intento y dueño del candado', async () => {
    const { service: feedbackService } = fakeFeedbackService();
    const processor = new InterviewPrepareProcessor(fakeService().service, feedbackService);

    await expect(
      processor.process(fakeJob(0, 2, JOB_INTERVIEW_FEEDBACK)),
    ).resolves.toEqual({ status: 'ready' });
    expect(feedbackService.run).toHaveBeenCalledWith(INTERVIEW_ID, 1, 'job-1');
  });

  it('job desconocido -> UnrecoverableError sin tocar ningún servicio', async () => {
    const { service } = fakeService();
    const { service: feedbackService } = fakeFeedbackService();
    const processor = new InterviewPrepareProcessor(service, feedbackService);

    await expect(processor.process(fakeJob(0, 2, 'otro'))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.run).not.toHaveBeenCalled();
    expect(feedbackService.run).not.toHaveBeenCalled();
  });

  it('error determinista -> UnrecoverableError (BullMQ no reintenta)', async () => {
    const cause = new AgentInvalidResponseError('faltan preguntas');
    const { service } = fakeService({ runThrows: cause });
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    const error = await processor.process(fakeJob(0)).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect((error as Error).cause).toBe(cause);
  });

  it('agente caído -> se propaga tal cual (BullMQ reintenta)', async () => {
    const cause = new AgentUnavailableError('timeout');
    const { service } = fakeService({ runThrows: cause });
    const processor = new InterviewPrepareProcessor(service, fakeFeedbackService().service);

    await expect(processor.process(fakeJob(0))).rejects.toBe(cause);
  });
});
