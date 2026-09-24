import { PendingActionsService } from './pending-actions.service.js';

describe('PendingActionsService.listFor', () => {
  it('no hay avisos pendientes: el resumen semanal ya no falla por credencial', async () => {
    await expect(new PendingActionsService().listFor('user-1')).resolves.toEqual([]);
  });
});
