/**
 * Módulo del job `coaching-brief` (SPEC-05 §2).
 *
 * Solo lo importa `JobsModule`, que a su vez solo lo importa `WorkerModule`:
 * la API no debe instanciar procesadores.
 *
 * `LlmService` ya viene construido de `LlmModule` (PR-04/T1): el `useFactory`
 * que este módulo duplicaba con `WeeklySummaryModule` se movió allí, que es
 * lo que pedía PEND-07 de docs/specs/pendientes/PR-05.md. `LlmModule`
 * reexporta `LlmInfraModule` (y con él `CredentialsModule`), así que
 * `CredentialsCrypto` y los tokens `LLM_CALL_SINK`/`LLM_EVENT_BUS` siguen
 * disponibles para el resto de providers de aquí.
 */
import { Module } from '@nestjs/common';

import { LlmModule } from '../../llm/llm.module.js';
import {
  CoachingBriefRepository,
  InsforgeCoachingBriefRepository,
} from './coaching-brief.repository.js';
import { CoachingBriefProcessor } from './coaching-brief.processor.js';
import { CoachingBriefService } from './coaching-brief.service.js';

@Module({
  imports: [LlmModule],
  providers: [
    {
      provide: CoachingBriefRepository,
      useClass: InsforgeCoachingBriefRepository,
    },
    CoachingBriefService,
    CoachingBriefProcessor,
  ],
  exports: [CoachingBriefService],
})
export class CoachingBriefModule {}
