import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { CredentialErrorEvent } from '../llm/llm.service.js';
import { CREDENTIAL_ERROR_EVENT } from '../llm/llm-infra.constants.js';
import { CredentialsService } from './credentials.service.js';

/**
 * Escucha el evento `credential.error` que emite `LlmService` (SPEC-03 §2)
 * cuando un proveedor responde 401/403 (`AUTH_ERROR`) o 402 (`NO_CREDITS`) y
 * marca la credencial: `provider_credentials.status = 'error'` y
 * `last_error` con el `code` del evento tal cual
 * (docs/specs/pendientes/PR-03.md PEND-07). La app lo muestra en la pantalla
 * de proveedores (RF-2.9).
 *
 * Nunca propaga un error: esto corre fuera del ciclo de la petición (el
 * `EventEmitter2` de Nest ignora el resultado del listener) y un fallo al
 * escribir el estado no debe convertirse en un rechazo no capturado.
 */
@Injectable()
export class CredentialErrorListener {
  private readonly logger = new Logger(CredentialErrorListener.name);

  constructor(private readonly credentialsService: CredentialsService) {}

  @OnEvent(CREDENTIAL_ERROR_EVENT)
  async handleCredentialError(event: CredentialErrorEvent): Promise<void> {
    try {
      await this.credentialsService.markCredentialError(
        event.userId,
        event.provider,
        event.code,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo marcar la credencial de '${event.provider}' como 'error': ` +
          `${(error as Error).message}`,
      );
    }
  }
}
