import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('returns ok:true and a string version', () => {
      const result = healthController.check();

      expect(result.ok).toBe(true);
      expect(typeof result.version).toBe('string');
      expect(result.version.length).toBeGreaterThan(0);
    });
  });
});
