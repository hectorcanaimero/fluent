import { Injectable } from '@nestjs/common';

/**
 * Acciones pendientes de `GET /me` (`MeDto.pendingActions`, SPEC-02 §4.1).
 *
 * Hoy no hay ninguna. `pendingActions` es un `string[]`, por lo que un aviso
 * futuro puede añadirse sin cambiar el contrato.
 */

@Injectable()
export class PendingActionsService {
  async listFor(_userId: string): Promise<string[]> {
    return [];
  }
}
