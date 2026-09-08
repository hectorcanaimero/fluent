import { Module } from '@nestjs/common';
import { SessionsQueryRepository } from './sessions-query.repository.js';

/**
 * Módulo hoja (sin imports propios) para `SessionsQueryRepository`,
 * compartido por `ProgressModule` y `SocialModule` (PR-02/T7). Ver el
 * comentario del repositorio para el motivo de aislarlo así.
 */
@Module({
  providers: [SessionsQueryRepository],
  exports: [SessionsQueryRepository],
})
export class SessionsQueryModule {}
