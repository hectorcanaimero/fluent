import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsRepository } from './interviews.repository.js';
import { InterviewsService } from './interviews.service.js';
import { StudyCycleService } from './study-cycle.service.js';

/**
 * Módulo `interviews` (I2, F10.3.T2): cuota, creación, consulta y reintento
 * de entrevistas. `RedisService`, `INSFORGE_ADMIN_CLIENT` y `JOB_DISPATCHER`
 * son globales (`RedisModule`, `InsforgeModule`, `QueuesModule`), así que no
 * hace falta importarlos; `ProfilesModule` sí, para `ProfilesRepository`
 * (plan efectivo y zona horaria, mismo criterio que `ModelsModule`).
 */
@Module({
  // `SessionsModule` aporta `InterviewSessionService` (abrir/retomar, F12.1.T2).
  // `LlmModule` y `SessionsRepository` (solo admin client): apertura de las
  // sesiones del ciclo de estudio (F13.1.T1).
  imports: [ProfilesModule, SessionsModule, LlmModule],
  controllers: [InterviewsController],
  providers: [InterviewsRepository, InterviewsService, SessionsRepository, StudyCycleService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
