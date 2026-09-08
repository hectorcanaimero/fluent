import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;

  const healthStatus: HealthStatus = {
    ok: true,
    version: '0.1.0',
    redis: { ok: true },
    insforge: { ok: true },
  };

  const healthServiceMock = {
    check: vi.fn().mockResolvedValue(healthStatus),
  };

  beforeEach(async () => {
    healthServiceMock.check.mockClear();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthServiceMock }],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('delegates to HealthService and returns its result', async () => {
      const result = await healthController.check();

      expect(healthServiceMock.check).toHaveBeenCalledTimes(1);
      expect(result).toEqual(healthStatus);
    });
  });
});
