import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';
import { QueueMetricsService } from './queue-metrics.service.js';

/**
 * Casos heredados de `admin-metrics.controller.spec.ts` (PR-05): al fusionar
 * PR-05 en PR-02 el controlador desapareció (una sola ruta
 * `GET /admin/metrics`) y su lógica pasó a `QueueMetricsService`, así que sus
 * tests se mueven aquí sin perder cobertura.
 */
describe('QueueMetricsService', () => {
  let service: QueueMetricsService;
  let briefQueueMock: Partial<Queue>;
  let contentQueueMock: Partial<Queue>;
  let socialQueueMock: Partial<Queue>;
  let maintenanceQueueMock: Partial<Queue>;

  function makeQueueMock(): Partial<Queue> {
    return {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 1, active: 2, failed: 3 }),
    };
  }

  beforeEach(async () => {
    briefQueueMock = makeQueueMock();
    contentQueueMock = makeQueueMock();
    socialQueueMock = makeQueueMock();
    maintenanceQueueMock = makeQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueMetricsService,
        { provide: getQueueToken(QUEUE_BRIEF), useValue: briefQueueMock },
        { provide: getQueueToken(QUEUE_CONTENT), useValue: contentQueueMock },
        { provide: getQueueToken(QUEUE_SOCIAL), useValue: socialQueueMock },
        { provide: getQueueToken(QUEUE_MAINTENANCE), useValue: maintenanceQueueMock },
      ],
    }).compile();

    service = module.get(QueueMetricsService);
  });

  it('devuelve los contadores de las 4 colas, en orden', async () => {
    const queues = await service.list();

    expect(queues).toEqual([
      { name: QUEUE_BRIEF, waiting: 1, active: 2, failed: 3 },
      { name: QUEUE_CONTENT, waiting: 1, active: 2, failed: 3 },
      { name: QUEUE_SOCIAL, waiting: 1, active: 2, failed: 3 },
      { name: QUEUE_MAINTENANCE, waiting: 1, active: 2, failed: 3 },
    ]);
  });

  it('llama a getJobCounts en cada cola con los tres estados', async () => {
    await service.list();

    for (const queue of [
      briefQueueMock,
      contentQueueMock,
      socialQueueMock,
      maintenanceQueueMock,
    ]) {
      expect(queue.getJobCounts).toHaveBeenCalledWith('waiting', 'active', 'failed');
    }
  });

  it('usa 0 cuando BullMQ no devuelve alguno de los contadores', async () => {
    // BullMQ tipa los contadores como `number`, pero en la práctica puede no
    // devolver alguno; el `as never` fuerza ese caso en el doble.
    vi.mocked(briefQueueMock.getJobCounts!).mockResolvedValueOnce({
      waiting: undefined,
      active: undefined,
      failed: undefined,
    } as never);

    const queues = await service.list();

    expect(queues[0]).toEqual({ name: QUEUE_BRIEF, waiting: 0, active: 0, failed: 0 });
  });
});
