import { Module } from '@nestjs/common';
import { CredentialErrorListener } from './credential-error.listener.js';
import { CredentialsCrypto } from './credentials.crypto.js';
import { CredentialsRepository } from './credentials.repository.js';
import { CredentialsService } from './credentials.service.js';

/**
 * Credenciales de proveedor cifradas (SPEC-02 §5, SPEC-01 §2.4).
 *
 * Exporta también `CredentialsCrypto`, la única implementación de cifrado del
 * repo (SPEC-02 §5): los jobs de PR-05 la inyectan para descifrar las filas
 * que cargan por su cuenta, en vez del `CredentialsCipher` de
 * `src/crypto/credentials-cipher.ts` que se borró al fusionar
 * (docs/specs/pendientes/PR-02.md PEND-72).
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
  providers: [
    CredentialsCrypto,
    CredentialsRepository,
    CredentialsService,
    CredentialErrorListener,
  ],
  exports: [CredentialsCrypto, CredentialsRepository, CredentialsService],
})
export class CredentialsModule {}
