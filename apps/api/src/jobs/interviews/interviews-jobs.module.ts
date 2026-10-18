/**
 * Módulo del job `interview-prepare` (F10.3.T3).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores (mismo patrón que
 * `CoachingBriefModule`/`WeeklySummaryModule`).
 */
import { Module } from '@nestjs/common';

import { InterviewAgentClient } from '../../interviews/interview-agent.client.js';
import { MemoryRepository } from '../../memory/memory.repository.js';
import { PushCoreModule } from '../../push/push.module.js';
import {
  InsforgeInterviewFeedbackRepository,
  InterviewFeedbackRepository,
} from './interview-feedback.repository.js';
import { InterviewFeedbackService } from './interview-feedback.service.js';
import { InterviewPrepareProcessor } from './interview-prepare.processor.js';
import {
  InsforgeInterviewPrepareRepository,
  InterviewPrepareRepository,
} from './interview-prepare.repository.js';
import { InterviewPrepareService } from './interview-prepare.service.js';

/**
 * `MemoryRepository` se declara aquí como provider propio (no se importa
 * `MemoryModule`): su único dependiente es `INSFORGE_ADMIN_CLIENT`, global
 * (`InsforgeModule`), mismo criterio que `InterviewAgentClient` ya seguía en
 * este módulo. Evita acoplar `InterviewsJobsModule` al módulo HTTP de
 * memoria (controller incluido) solo para reusar una clase sin estado.
 */
@Module({
  imports: [PushCoreModule],
  providers: [
    {
      provide: InterviewPrepareRepository,
      useClass: InsforgeInterviewPrepareRepository,
    },
    {
      provide: InterviewFeedbackRepository,
      useClass: InsforgeInterviewFeedbackRepository,
    },
    InterviewAgentClient,
    MemoryRepository,
    InterviewPrepareService,
    InterviewFeedbackService,
    InterviewPrepareProcessor,
  ],
  exports: [InterviewPrepareService, InterviewFeedbackService],
})
export class InterviewsJobsModule {}
