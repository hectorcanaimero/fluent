import { Logger } from '@nestjs/common';
import type { RedisService } from '../redis/redis.service.js';
import { pendingCredentialKey } from '../jobs/weekly-summary/pending-credential.store.js';
import {
  PendingActionsService,
  WEEKLY_SUMMARY_NEEDS_CREDENTIAL,
} from './pending-actions.service.js';

const USER_ID = '9595625c-aea8-4120-accc-ed149d0a84c6';

function createService(get: (key: string) => Promise<string | null>) {
  const redisService = { get: vi.fn(get) };
  return {
    service: new PendingActionsService(redisService as unknown as RedisService),
    redisService,
  };
}

describe('PendingActionsService.listFor (SPEC-02 §4.1, SPEC-05 §4 paso 3)', () => {
  it('lee exactamente la clave que escribe el job de PR-05', async () => {
    const { service, redisService } = createService(async () => null);

    await service.listFor(USER_ID);

    expect(redisService.get).toHaveBeenCalledWith(
      `fluent:pending:weekly-summary-credential:${USER_ID}`,
    );
    // Y esa es la misma que construye el propio store del job.
    expect(redisService.get).toHaveBeenCalledWith(pendingCredentialKey(USER_ID));
  });

  it('sin clave, no hay acciones pendientes', async () => {
    const { service } = createService(async () => null);

    await expect(service.listFor(USER_ID)).resolves.toEqual([]);
  });

  it('con la clave puesta, devuelve WEEKLY_SUMMARY_NEEDS_CREDENTIAL', async () => {
    const value = JSON.stringify({
      groupId: 'group-1',
      weekStart: '2026-09-07',
      code: 'NO_CREDENTIAL',
    });
    const { service } = createService(async () => value);

    await expect(service.listFor(USER_ID)).resolves.toEqual([
      WEEKLY_SUMMARY_NEEDS_CREDENTIAL,
    ]);
  });

  it('ignora un valor con un code desconocido', async () => {
    const { service } = createService(async () => JSON.stringify({ code: 'OTRA_COSA' }));

    await expect(service.listFor(USER_ID)).resolves.toEqual([]);
  });

  it('ignora (con warn) un valor que no es JSON válido', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const { service } = createService(async () => 'no-es-json');

    await expect(service.listFor(USER_ID)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  /**
   * `RedisService.get` ya traga sus propios errores y devuelve `null` (PEND-01),
   * así que un Redis caído se comporta igual que un *miss*: `GET /me` responde
   * sin acciones pendientes en vez de fallar.
   */
  it('con Redis caído (get -> null) responde sin acciones, sin lanzar', async () => {
    const { service } = createService(async () => null);

    await expect(service.listFor(USER_ID)).resolves.toEqual([]);
  });
});
