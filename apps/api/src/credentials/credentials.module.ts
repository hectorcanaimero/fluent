import { Module } from '@nestjs/common';
import { CredentialErrorListener } from './credential-error.listener.js';
import { CredentialsRepository } from './credentials.repository.js';
import { CredentialsService } from './credentials.service.js';

/**
 * Credenciales de proveedor cifradas (SPEC-02 §5, SPEC-01 §2.4).
 *
 * Exporta `CredentialsService` (que implementa `CredentialsSource` de
 * `apps/api/src/llm/model-resolver.ts`) y `CredentialsRepository` para que
 * `ProvidersModule`, `ProfilesModule` (`GET /me`) y los PRs siguientes
 * (PR-04, PR-05) los inyecten sin duplicar lógica de cifrado.
 *
 * `CredentialErrorListener` se registra aquí porque es quien traduce el
 * evento `credential.error` de PR-03 a un UPDATE de `provider_credentials`;
 * el `EventEmitterModule` global lo registra AppModule.
 */
@Module({
  providers: [CredentialsRepository, CredentialsService, CredentialErrorListener],
  exports: [CredentialsRepository, CredentialsService],
})
export class CredentialsModule {}
