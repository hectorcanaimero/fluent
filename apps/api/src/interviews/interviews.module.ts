import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsRepository } from './interviews.repository.js';
import { InterviewsService } from './interviews.service.js';

/**
 * Módulo `interviews` (I2, F10.3.T2): cuota, creación, consulta y reintento
 * de entrevistas. `RedisService`, `INSFORGE_ADMIN_CLIENT` y `JOB_DISPATCHER`
 * son globales (`RedisModule`, `InsforgeModule`, `QueuesModule`), así que no
 * hace falta importarlos; `ProfilesModule` sí, para `ProfilesRepository`
 * (plan efectivo y zona horaria, mismo criterio que `ModelsModule`).
 */
@Module({
  imports: [ProfilesModule],
  controllers: [InterviewsController],
  providers: [InterviewsRepository, InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
