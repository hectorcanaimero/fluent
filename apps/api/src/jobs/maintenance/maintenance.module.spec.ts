import { getQueueToken } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { INSFORGE_ADMIN_CLIENT } from '../../insforge/insforge.constants.js';
import { REDIS_CACHE_CLIENT } from '../../redis/redis.constants.js';
import { SessionSweeperService } from '../../sessions/session-sweeper.service.js';
import { JOB_DISPATCHER } from '../job-dispatcher.js';
import { QUEUE_MAINTENANCE } from '../jobs.constants.js';
import { SESSION_SWEEPER } from '../session-sweeper.js';
import { MaintenanceModule } from './maintenance.module.js';
import { MaintenanceProcessor } from './maintenance.processor.js';

/**
 * `MaintenanceModule` (y el `SessionSweeperModule` que ahora importa, PR-04/
 * T5) da por puestos los módulos `@Global()` que en el worker real provee
 * `WorkerModule` — `InsforgeModule` (`INSFORGE_ADMIN_CLIENT`), `RedisModule`
 * (`REDIS_CACHE_CLIENT`) y `QueuesModule` (`JOB_DISPATCHER` y la `Queue` de
 * `maintenance`) — y no los importa él mismo. Para comprobar en aislamiento
 * que el árbol de módulos sigue compilando (docs/tasks/PR-04-sesion.md T5:
 * «Comprueba que el worker sigue arrancando») se sustituyen aquí por un
 * módulo `@Global()` de mentira con los mismos tokens, sin tocar Redis ni
 * InsForge reales — no existía ningún test previo que compilase
 * `WorkerModule` ni `MaintenanceModule` con `Test.createTestingModule`.
 */
@Global()
@Module({
  providers: [
    { provide: INSFORGE_ADMIN_CLIENT, useValue: {} },
    { provide: REDIS_CACHE_CLIENT, useValue: { get: vi.fn(), set: vi.fn() } },
    { provide: JOB_DISPATCHER, useValue: { enqueueCoachingBrief: vi.fn() } },
    {
      provide: getQueueToken(QUEUE_MAINTENANCE),
      useValue: { upsertJobScheduler: vi.fn(async () => ({}) as never) },
    },
  ],
  exports: [
    INSFORGE_ADMIN_CLIENT,
    REDIS_CACHE_CLIENT,
    JOB_DISPATCHER,
    getQueueToken(QUEUE_MAINTENANCE),
  ],
})
class FakeWorkerInfraModule {}

describe('MaintenanceModule', () => {
  it('compila con dobles de InsForge/Redis/colas y resuelve SESSION_SWEEPER a SessionSweeperService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeWorkerInfraModule, MaintenanceModule],
    }).compile();

    const sweeper = moduleRef.get(SESSION_SWEEPER);
    expect(sweeper).toBeInstanceOf(SessionSweeperService);

    const processor = moduleRef.get(MaintenanceProcessor);
    expect(processor).toBeDefined();

    await moduleRef.close();
  });
});
