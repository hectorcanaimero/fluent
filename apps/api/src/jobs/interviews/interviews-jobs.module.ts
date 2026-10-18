/**
 * Módulo del job `interview-prepare` (F10.3.T3).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores (mismo patrón que
 * `CoachingBriefModule`/`WeeklySummaryModule`).
 */
import { Module } from '@nestjs/common';

import { InterviewAgentClient } from '../../interviews/interview-agent.client.js';
import { PushCoreModule } from '../../push/push.module.js';
import { InterviewPrepareProcessor } from './interview-prepare.processor.js';
import {
  InsforgeInterviewPrepareRepository,
  InterviewPrepareRepository,
} from './interview-prepare.repository.js';
import { InterviewPrepareService } from './interview-prepare.service.js';

@Module({
  imports: [PushCoreModule],
  providers: [
    {
      provide: InterviewPrepareRepository,
      useClass: InsforgeInterviewPrepareRepository,
    },
    InterviewAgentClient,
    InterviewPrepareService,
    InterviewPrepareProcessor,
  ],
  exports: [InterviewPrepareService],
})
export class InterviewsJobsModule {}
