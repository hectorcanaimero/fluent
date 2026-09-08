import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CredentialErrorEvent, LlmEventBus } from './llm.service.js';

/**
 * `LlmEventBus` de SPEC-03 §2 sobre el `EventEmitter2` de
 * `@nestjs/event-emitter`.
 *
 * `LlmService` (PR-03) emite `credential.error` cuando un proveedor devuelve
 * 401/403/402; `CredentialErrorListener` (PR-02/T4) lo recibe y marca la fila
 * de `provider_credentials`. La emisión es síncrona y sin valor de retorno:
 * el turno del usuario no espera a que se escriba el estado.
 */
@Injectable()
export class NestLlmEventBus implements LlmEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: 'credential.error', payload: CredentialErrorEvent): void {
    this.emitter.emit(event, payload);
  }
}
