import { Injectable } from '@nestjs/common';

/**
 * Acciones pendientes de `GET /me` (`MeDto.pendingActions`, SPEC-02 §4.1).
 *
 * Hoy no hay ninguna: el resumen semanal ya no puede fallar por credencial
 * (usa la del operador), así que el aviso `WEEKLY_SUMMARY_NEEDS_CREDENTIAL`
 * desapareció. `pendingActions` es un `string[]`, por lo que un aviso futuro
 * puede añadirse sin cambiar el contrato.
 */
export const WEEKLY_SUMMARY_NEEDS_CREDENTIAL = 'WEEKLY_SUMMARY_NEEDS_CREDENTIAL';

@Injectable()
export class PendingActionsService {
  async listFor(_userId: string): Promise<string[]> {
    return [];
  }
}
