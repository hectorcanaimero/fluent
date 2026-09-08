import { Test, TestingModule } from '@nestjs/testing';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { OwnerAuthGuard } from './owner-auth.guard.js';
import { ConfigService } from '@nestjs/config';
import { InsforgeHttp } from '../insforge/insforge.http.js';
import type { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';

describe('AdminMetricsController', () => {
  let controller: AdminMetricsController;
  let briefQueueMock: Partial<Queue>;
  let contentQueueMock: Partial<Queue>;
  let socialQueueMock: Partial<Queue>;
  let maintenanceQueueMock: Partial<Queue>;

  beforeEach(async () => {
    briefQueueMock = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 1,
        active: 2,
        failed: 3,
      }),
    };

    contentQueueMock = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 1,
        active: 2,
        failed: 3,
      }),
    };

    socialQueueMock = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 1,
        active: 2,
        failed: 3,
      }),
    };

    maintenanceQueueMock = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 1,
        active: 2,
        failed: 3,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMetricsController],
      providers: [
        { provide: getQueueToken(QUEUE_BRIEF), useValue: briefQueueMock },
        {
          provide: getQueueToken(QUEUE_CONTENT),
          useValue: contentQueueMock,
        },
        { provide: getQueueToken(QUEUE_SOCIAL), useValue: socialQueueMock },
        {
          provide: getQueueToken(QUEUE_MAINTENANCE),
          useValue: maintenanceQueueMock,
        },
        {
          provide: OwnerAuthGuard,
          useValue: {
            canActivate: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: InsforgeHttp,
          useValue: { getCurrentSession: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi
              .fn()
              .mockReturnValue('d41e8bce-c1c1-4f2a-b123-456789abcdef'),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminMetricsController>(AdminMetricsController);
  });

  describe('metrics', () => {
    it('should return metrics for all 4 queues', async () => {
      const result = await controller.metrics();

      expect(result.queues).toHaveLength(4);
      expect(result.queues[0]).toEqual({
        name: QUEUE_BRIEF,
        waiting: 1,
        active: 2,
        failed: 3,
      });
      expect(result.queues[1]).toEqual({
        name: QUEUE_CONTENT,
        waiting: 1,
        active: 2,
        failed: 3,
      });
      expect(result.queues[2]).toEqual({
        name: QUEUE_SOCIAL,
        waiting: 1,
        active: 2,
        failed: 3,
      });
      expect(result.queues[3]).toEqual({
        name: QUEUE_MAINTENANCE,
        waiting: 1,
        active: 2,
        failed: 3,
      });
    });

    it('should call getJobCounts on each queue', async () => {
      await controller.metrics();

      expect(briefQueueMock.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'failed',
      );
      expect(contentQueueMock.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'failed',
      );
      expect(socialQueueMock.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'failed',
      );
      expect(maintenanceQueueMock.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'failed',
      );
    });

    it('should handle undefined job counts by using 0 as fallback', async () => {
      vi.mocked(briefQueueMock.getJobCounts).mockResolvedValueOnce({
        waiting: undefined,
        active: undefined,
        failed: undefined,
      });

      const result = await controller.metrics();

      expect(result.queues[0]).toEqual({
        name: QUEUE_BRIEF,
        waiting: 0,
        active: 0,
        failed: 0,
      });
    });
  });
});
